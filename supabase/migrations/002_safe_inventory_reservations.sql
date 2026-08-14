-- NOVERA Commerce 2.0
-- Migration 002: safe pending-payment inventory reservations.
-- Run once in Supabase SQL Editor after the existing commerce schema.

alter table public.orders
  add column if not exists reservation_expires_at timestamptz;

create index if not exists orders_reservation_expires_idx
  on public.orders(reservation_expires_at)
  where payment_status = 'pending';

-- Replaces the earlier create_order implementation.
-- It reserves stock instead of permanently decrementing stock while payment is pending.
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
  v_qty integer;
  v_line numeric(10,3);
  v_unit_price numeric(10,3);
  v_product_name text;
begin
  if nullif(trim(p_customer_email), '') is null
     or nullif(trim(p_customer_first_name), '') is null
     or nullif(trim(p_customer_last_name), '') is null
     or nullif(trim(p_customer_phone), '') is null
     or nullif(trim(p_shipping_address), '') is null
     or nullif(trim(p_shipping_city), '') is null then
    raise exception 'Required customer or shipping details are missing';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  insert into public.orders (
    order_number, customer_email, customer_first_name, customer_last_name,
    customer_phone, shipping_address, shipping_city, shipping_postal, notes,
    subtotal_bhd, total_bhd, payment_status, fulfillment_status,
    reservation_expires_at
  ) values (
    'NV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    lower(trim(p_customer_email)), trim(p_customer_first_name), trim(p_customer_last_name),
    trim(p_customer_phone), trim(p_shipping_address), trim(p_shipping_city),
    nullif(trim(p_shipping_postal), ''), nullif(trim(p_notes), ''),
    0, 0, 'pending', 'pending', now() + interval '20 minutes'
  ) returning id, order_number into v_order_id, v_order_number;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'Invalid quantity';
    end;

    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_variant
      from public.product_variants
     where id = (v_item->>'variantId')::uuid
     for update;

    if not found then
      raise exception 'Product variant not found';
    end if;

    if v_variant.stock - v_variant.reserved < v_qty then
      raise exception 'Insufficient stock for SKU %', v_variant.sku;
    end if;

    select p.price_bhd, p.name
      into v_unit_price, v_product_name
      from public.products p
     where p.id = v_variant.product_id
       and p.status = 'active';

    if not found then
      raise exception 'Product unavailable';
    end if;

    v_line := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line;

    insert into public.order_items (
      order_id, variant_id, product_name, sku, size, color,
      unit_price_bhd, quantity, line_total_bhd
    ) values (
      v_order_id, v_variant.id, v_product_name, v_variant.sku,
      v_variant.size, v_variant.color, v_unit_price, v_qty, v_line
    );

    update public.product_variants
       set reserved = reserved + v_qty,
           updated_at = now()
     where id = v_variant.id;
  end loop;

  update public.orders
     set subtotal_bhd = v_subtotal,
         total_bhd = v_subtotal,
         updated_at = now()
   where id = v_order_id;

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'subtotalBhd', v_subtotal,
    'totalBhd', v_subtotal,
    'reservationExpiresAt', now() + interval '20 minutes'
  );
end;
$$;

-- Finalize a successful payment: convert reservation into a real stock deduction.
create or replace function public.confirm_order_payment(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items%rowtype;
begin
  if not exists (
    select 1 from public.orders
     where id = p_order_id and payment_status = 'pending'
  ) then
    return false;
  end if;

  for v_item in select * from public.order_items where order_id = p_order_id loop
    update public.product_variants
       set stock = stock - v_item.quantity,
           reserved = reserved - v_item.quantity,
           updated_at = now()
     where id = v_item.variant_id
       and reserved >= v_item.quantity
       and stock >= v_item.quantity;

    if not found then
      raise exception 'Unable to finalize inventory for SKU %', v_item.sku;
    end if;
  end loop;

  update public.orders
     set payment_status = 'paid',
         fulfillment_status = 'processing',
         reservation_expires_at = null,
         updated_at = now()
   where id = p_order_id;

  return true;
end;
$$;

-- Release an unpaid reservation and cancel the order.
create or replace function public.cancel_order_reservation(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items%rowtype;
begin
  if not exists (
    select 1 from public.orders
     where id = p_order_id and payment_status = 'pending'
  ) then
    return false;
  end if;

  for v_item in select * from public.order_items where order_id = p_order_id loop
    update public.product_variants
       set reserved = greatest(0, reserved - v_item.quantity),
           updated_at = now()
     where id = v_item.variant_id;
  end loop;

  update public.orders
     set payment_status = 'failed',
         fulfillment_status = 'cancelled',
         reservation_expires_at = null,
         updated_at = now()
   where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.create_order(text,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.confirm_order_payment(uuid) from public, anon, authenticated;
revoke all on function public.cancel_order_reservation(uuid) from public, anon, authenticated;

-- Service-role server code is the intended caller for these functions.
