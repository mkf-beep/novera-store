-- NOVERA Commerce 2.0 — safe order reservation flow
-- Run this migration in the Supabase SQL Editor.
-- Orders reserve inventory while payment is pending. Stock is only deducted after payment confirmation.

create or replace function public.create_order(
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_shipping_address text,
  p_shipping_city text,
  p_shipping_postal text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10,3) := 0;
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_qty integer;
  v_line numeric(10,3);
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  if length(trim(p_customer_email)) < 5 then raise exception 'Invalid email'; end if;
  if length(trim(p_customer_first_name)) = 0 or length(trim(p_customer_last_name)) = 0 then raise exception 'Customer name is required'; end if;
  if length(trim(p_customer_phone)) = 0 or length(trim(p_shipping_address)) = 0 or length(trim(p_shipping_city)) = 0 then raise exception 'Shipping details are required'; end if;

  insert into public.orders (
    order_number, customer_email, customer_first_name, customer_last_name,
    customer_phone, shipping_address, shipping_city, shipping_postal, notes,
    subtotal_bhd, total_bhd, payment_status, fulfillment_status
  ) values (
    'NV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    lower(trim(p_customer_email)), trim(p_customer_first_name), trim(p_customer_last_name),
    trim(p_customer_phone), trim(p_shipping_address), trim(p_shipping_city), nullif(trim(p_shipping_postal), ''),
    nullif(trim(p_notes), ''), 0, 0, 'pending', 'pending'
  ) returning id, order_number into v_order_id, v_order_number;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'Invalid quantity'; end if;

    select * into v_variant
    from public.product_variants
    where id = (v_item->>'variantId')::uuid
    for update;

    if not found then raise exception 'Product variant not found'; end if;

    select * into v_product
    from public.products
    where id = v_variant.product_id and status = 'active';

    if not found then raise exception 'Product unavailable'; end if;

    if v_variant.stock - v_variant.reserved < v_qty then
      raise exception 'Insufficient stock for SKU %', v_variant.sku;
    end if;

    v_line := v_product.price_bhd * v_qty;
    v_subtotal := v_subtotal + v_line;

    insert into public.order_items (
      order_id, variant_id, product_name, sku, size, color,
      unit_price_bhd, quantity, line_total_bhd
    ) values (
      v_order_id, v_variant.id, v_product.name, v_variant.sku, v_variant.size, v_variant.color,
      v_product.price_bhd, v_qty, v_line
    );

    -- Reserve, do not deduct, until the payment provider confirms payment.
    update public.product_variants
    set reserved = reserved + v_qty, updated_at = now()
    where id = v_variant.id;
  end loop;

  update public.orders
  set subtotal_bhd = v_subtotal, total_bhd = v_subtotal, updated_at = now()
  where id = v_order_id;

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'subtotalBhd', v_subtotal,
    'totalBhd', v_subtotal,
    'paymentStatus', 'pending'
  );
exception when others then
  -- The transaction automatically rolls back all reservations and inserts on error.
  raise;
end;
$$;

create or replace function public.confirm_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status = 'paid' then
    return jsonb_build_object('ok', true, 'orderId', p_order_id, 'status', 'paid');
  end if;
  if v_order.payment_status <> 'pending' then raise exception 'Order is not payable'; end if;

  for v_item in select * from public.order_items where order_id = p_order_id loop
    update public.product_variants
    set stock = stock - v_item.quantity,
        reserved = reserved - v_item.quantity,
        updated_at = now()
    where id = v_item.variant_id
      and stock >= v_item.quantity
      and reserved >= v_item.quantity;

    if not found then raise exception 'Inventory changed before payment confirmation'; end if;
  end loop;

  update public.orders
  set payment_status = 'paid', fulfillment_status = 'processing', updated_at = now()
  where id = p_order_id;

  return jsonb_build_object('ok', true, 'orderId', p_order_id, 'status', 'paid');
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status <> 'pending' then
    raise exception 'Only pending orders can be cancelled';
  end if;

  for v_item in select * from public.order_items where order_id = p_order_id loop
    update public.product_variants
    set reserved = greatest(0, reserved - v_item.quantity), updated_at = now()
    where id = v_item.variant_id;
  end loop;

  update public.orders
  set payment_status = 'failed', fulfillment_status = 'cancelled', updated_at = now()
  where id = p_order_id;

  return jsonb_build_object('ok', true, 'orderId', p_order_id, 'status', 'cancelled');
end;
$$;

-- Release abandoned reservations after the payment window expires.
create or replace function public.release_expired_orders(p_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item record;
  v_count integer := 0;
begin
  for v_order in
    select id from public.orders
    where payment_status = 'pending'
      and created_at < now() - make_interval(mins => greatest(1, p_minutes))
    for update skip locked
  loop
    for v_item in select * from public.order_items where order_id = v_order.id loop
      update public.product_variants
      set reserved = greatest(0, reserved - v_item.quantity), updated_at = now()
      where id = v_item.variant_id;
    end loop;
    update public.orders
    set payment_status = 'failed', fulfillment_status = 'cancelled', updated_at = now()
    where id = v_order.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.create_order(text,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.confirm_order(uuid) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid) from public, anon, authenticated;
revoke all on function public.release_expired_orders(integer) from public, anon, authenticated;
