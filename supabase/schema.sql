-- NOVERA Commerce 2.0
-- Core commerce schema for Supabase/Postgres.
-- Run this in the Supabase SQL Editor before enabling live orders.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_bhd numeric(10,3) not null check (price_bhd >= 0),
  status text not null default 'active' check (status in ('active','draft','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text not null check (size in ('S','M','L','XL','2XL')),
  color text not null default 'Black',
  stock integer not null default 0 check (stock >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= stock),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, size, color)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_email text not null,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_phone text not null,
  shipping_address text not null,
  shipping_city text not null,
  shipping_postal text,
  notes text,
  subtotal_bhd numeric(10,3) not null check (subtotal_bhd >= 0),
  shipping_bhd numeric(10,3) not null default 0 check (shipping_bhd >= 0),
  discount_bhd numeric(10,3) not null default 0 check (discount_bhd >= 0),
  total_bhd numeric(10,3) not null check (total_bhd >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  fulfillment_status text not null default 'pending' check (fulfillment_status in ('pending','processing','shipped','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  product_name text not null,
  sku text not null,
  size text not null,
  color text not null,
  unit_price_bhd numeric(10,3) not null check (unit_price_bhd >= 0),
  quantity integer not null check (quantity > 0),
  line_total_bhd numeric(10,3) not null check (line_total_bhd >= 0)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(10,3) not null check (discount_value > 0),
  min_order_bhd numeric(10,3) not null default 0 check (min_order_bhd >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_variants_product_idx on public.product_variants(product_id);
create index if not exists orders_email_idx on public.orders(customer_email);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

insert into public.products (slug, name, description, price_bhd)
values
  ('eclipse','NOVERA Eclipse','Graphite football streetwear jersey',22),
  ('atlas','NOVERA Atlas','Stone and forest performance jersey',24),
  ('velocity','NOVERA Velocity','Burgundy and gold football culture jersey',22)
on conflict (slug) do nothing;

insert into public.product_variants (product_id, sku, size, color)
select p.id, 'NO-' || upper(p.slug) || '-' || s.size, s.size, 'Black'
from public.products p
cross join (values ('S'),('M'),('L'),('XL'),('2XL')) as s(size)
on conflict (product_id, size, color) do nothing;

-- Atomic server-side order creation.
-- The browser supplies only variant IDs and quantities.
-- Price, product identity and stock are read and validated inside Postgres.
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
    subtotal_bhd, total_bhd
  ) values (
    'NV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    lower(trim(p_customer_email)), trim(p_customer_first_name), trim(p_customer_last_name),
    trim(p_customer_phone), trim(p_shipping_address), trim(p_shipping_city), nullif(trim(p_shipping_postal), ''),
    nullif(trim(p_notes), ''), 0, 0
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
    set stock = stock - v_qty, updated_at = now()
    where id = v_variant.id;
  end loop;

  update public.orders
  set subtotal_bhd = v_subtotal, total_bhd = v_subtotal, updated_at = now()
  where id = v_order_id;

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'subtotalBhd', v_subtotal,
    'totalBhd', v_subtotal
  );
end;
$$;

revoke all on function public.create_order(text,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;

-- Important: do not enable public writes to orders or inventory.
-- The server-side service role is the only intended caller of create_order.
