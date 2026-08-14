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

-- Seed products only; inventory remains 0 until the owner confirms the factory quantity.
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

-- Important: do not enable public writes to orders or inventory.
-- Server-side service-role access must be used for order creation and stock changes.
