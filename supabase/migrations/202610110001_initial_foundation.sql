-- VyapaarOS foundation schema.
-- Authentication user provisioning and the atomic process_sale RPC are intentionally pending.

create extension if not exists pgcrypto;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now()
);

create table public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index shop_members_user_id_idx on public.shop_members(user_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  phone text,
  email text,
  created_at timestamptz not null default now(),
  unique (shop_id, id)
);
create index customers_shop_created_idx on public.customers(shop_id, created_at desc);
create index customers_shop_phone_idx on public.customers(shop_id, phone) where phone is not null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sku text,
  name text not null check (char_length(trim(name)) between 1 and 180),
  unit text not null default 'unit' check (char_length(trim(unit)) between 1 and 40),
  sale_price_paise bigint not null check (sale_price_paise >= 0),
  cost_price_paise bigint not null default 0 check (cost_price_paise >= 0),
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  stock_quantity numeric(12,3) not null default 0 check (stock_quantity >= 0),
  low_stock_threshold numeric(12,3) not null default 0 check (low_stock_threshold >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);
create unique index products_shop_sku_unique on public.products(shop_id, lower(sku)) where sku is not null;
create index products_shop_active_name_idx on public.products(shop_id, active, name);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid,
  source text not null check (source in ('pos', 'online')),
  source_order_id uuid,
  invoice_number text not null,
  status text not null default 'completed' check (status in ('completed', 'voided', 'refunded')),
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  tax_paise bigint not null check (tax_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  total_paise bigint not null check (total_paise >= 0),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sales_customer_shop_fk foreign key (shop_id, customer_id)
    references public.customers(shop_id, id) on delete set null (customer_id),
  constraint sales_shop_id_id_unique unique (shop_id, id),
  constraint sales_shop_invoice_unique unique (shop_id, invoice_number),
  constraint sales_shop_idempotency_unique unique (shop_id, idempotency_key),
  constraint sales_total_matches_components check (total_paise = subtotal_paise + tax_paise - discount_paise)
);
create index sales_shop_created_idx on public.sales(shop_id, created_at desc);
create index sales_shop_customer_idx on public.sales(shop_id, customer_id) where customer_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  sale_id uuid not null,
  product_id uuid not null,
  product_name_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  line_subtotal_paise bigint not null check (line_subtotal_paise >= 0),
  line_tax_paise bigint not null check (line_tax_paise >= 0),
  line_total_paise bigint not null check (line_total_paise = line_subtotal_paise + line_tax_paise),
  created_at timestamptz not null default now(),
  foreign key (shop_id, sale_id) references public.sales(shop_id, id) on delete cascade,
  foreign key (shop_id, product_id) references public.products(shop_id, id) on delete restrict
);
create index sale_items_sale_idx on public.sale_items(shop_id, sale_id);
create index sale_items_product_idx on public.sale_items(shop_id, product_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid not null,
  sale_id uuid,
  reason text not null check (reason in ('sale', 'purchase', 'adjustment', 'return')),
  quantity_delta numeric(12,3) not null check (quantity_delta <> 0),
  created_at timestamptz not null default now(),
  foreign key (shop_id, product_id) references public.products(shop_id, id) on delete restrict,
  foreign key (shop_id, sale_id) references public.sales(shop_id, id) on delete restrict
);
create index inventory_movements_product_time_idx on public.inventory_movements(shop_id, product_id, created_at desc);
create index inventory_movements_sale_idx on public.inventory_movements(shop_id, sale_id) where sale_id is not null;

-- These SECURITY DEFINER membership helpers bypass table RLS only for membership lookup.
-- Keep their fixed search_path and review them with the rest of the policies before launch.
create or replace function public.is_shop_member(target_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_members sm
    where sm.shop_id = target_shop_id and sm.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_shop_role(target_shop_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_members sm
    where sm.shop_id = target_shop_id
      and sm.user_id = (select auth.uid())
      and sm.role = any (allowed_roles)
  );
$$;

revoke all on function public.is_shop_member(uuid) from public;
revoke all on function public.has_shop_role(uuid, text[]) from public;
grant execute on function public.is_shop_member(uuid) to authenticated;
grant execute on function public.has_shop_role(uuid, text[]) to authenticated;

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy shops_read_member on public.shops for select to authenticated
  using (public.is_shop_member(id));
create policy shops_update_owner on public.shops for update to authenticated
  using (public.has_shop_role(id, array['owner']))
  with check (public.has_shop_role(id, array['owner']));

create policy shop_members_read_own_or_shop on public.shop_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_shop_member(shop_id));

create policy customers_read_member on public.customers for select to authenticated
  using (public.is_shop_member(shop_id));
create policy customers_insert_manager on public.customers for insert to authenticated
  with check (public.has_shop_role(shop_id, array['owner', 'manager', 'staff']));
create policy customers_update_manager on public.customers for update to authenticated
  using (public.has_shop_role(shop_id, array['owner', 'manager', 'staff']))
  with check (public.has_shop_role(shop_id, array['owner', 'manager', 'staff']));
create policy customers_delete_manager on public.customers for delete to authenticated
  using (public.has_shop_role(shop_id, array['owner', 'manager']));

create policy products_read_member on public.products for select to authenticated
  using (public.is_shop_member(shop_id));
create policy products_insert_manager on public.products for insert to authenticated
  with check (public.has_shop_role(shop_id, array['owner', 'manager']));
create policy products_update_manager on public.products for update to authenticated
  using (public.has_shop_role(shop_id, array['owner', 'manager']))
  with check (public.has_shop_role(shop_id, array['owner', 'manager']));
create policy products_delete_manager on public.products for delete to authenticated
  using (public.has_shop_role(shop_id, array['owner']));

-- Sales and stock ledger are readable by shop members. There are deliberately no
-- direct INSERT/UPDATE/DELETE policies yet: writes must go through process_sale.
create policy sales_read_member on public.sales for select to authenticated
  using (public.is_shop_member(shop_id));
create policy sale_items_read_member on public.sale_items for select to authenticated
  using (public.is_shop_member(shop_id));
create policy inventory_movements_read_member on public.inventory_movements for select to authenticated
  using (public.is_shop_member(shop_id));

-- Shop and membership creation is intentionally reserved for a trusted onboarding path.
-- Do not add client policies that let a user grant themselves shop ownership.
