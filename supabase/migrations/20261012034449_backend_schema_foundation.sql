-- Additive backend foundation for VyapaarOS.
-- This migration does not create orders, process payments, or implement a sale RPC.
-- It has not been applied to a database as part of this task.

-- Give membership records UUID primary keys while retaining the tenant/user
-- pair's uniqueness. Existing membership rows receive generated stable IDs.
alter table public.shop_members add column id uuid not null default gen_random_uuid();
alter table public.shop_members drop constraint shop_members_pkey;
alter table public.shop_members add constraint shop_members_pkey primary key (id);
alter table public.shop_members add constraint shop_members_shop_user_unique unique (shop_id, user_id);

-- Retain whole-unit behavior from the current UI without coercing any existing
-- fractional rows. NOT VALID protects new/updated rows; validate after reviewing
-- existing data before relying on these constraints for historical rows.
alter table public.products
  add constraint products_stock_whole_units
    check (stock_quantity = trunc(stock_quantity)) not valid,
  add constraint products_low_stock_whole_units
    check (low_stock_threshold = trunc(low_stock_threshold)) not valid;

alter table public.sale_items
  add column unit_snapshot text,
  add column sku_snapshot text,
  add column cost_price_paise_snapshot bigint,
  add constraint sale_items_quantity_whole_units
    check (quantity = trunc(quantity)) not valid,
  add constraint sale_items_subtotal_matches_quantity
    check (line_subtotal_paise = quantity * unit_price_paise) not valid,
  add constraint sale_items_cost_snapshot_nonnegative
    check (cost_price_paise_snapshot is null or cost_price_paise_snapshot >= 0) not valid;

comment on column public.sale_items.unit_snapshot is
  'Unit label copied at sale time when new sale writes are implemented; existing rows remain NULL because historical units cannot be reconstructed reliably.';
comment on column public.sale_items.sku_snapshot is
  'SKU copied at sale time when available; existing rows remain NULL because historical SKU values are not stored.';
comment on column public.sale_items.cost_price_paise_snapshot is
  'Optional cost snapshot for future gross-profit estimates; existing rows remain NULL because historical cost is unavailable.';

alter table public.sales
  add constraint sales_discount_not_above_subtotal
    check (discount_paise <= subtotal_paise) not valid,
  add constraint sales_shop_id_customer_unique
    unique (shop_id, id, customer_id);

-- Historical customer links must not disappear when a profile is removed.
-- There is no customer-delete workflow in the app; profiles should be retained.
alter table public.sales drop constraint sales_customer_shop_fk;
alter table public.sales
  add constraint sales_customer_shop_fk foreign key (shop_id, customer_id)
  references public.customers(shop_id, id) on delete restrict;

-- Add the demo model's cached balance for future reads. The loyalty ledger is
-- authoritative; this cache is deliberately unavailable for browser-side writes.
alter table public.customers
  add column loyalty_points integer not null default 0,
  add constraint customers_loyalty_points_nonnegative check (loyalty_points >= 0);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  category text not null check (char_length(trim(category)) between 1 and 50),
  description text not null check (char_length(trim(description)) between 1 and 180),
  payment_method text not null check (payment_method in ('cash', 'upi', 'card', 'bank_transfer', 'other')),
  occurred_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  unique (shop_id, id),
  constraint expenses_void_fields_consistent check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and char_length(trim(coalesce(void_reason, ''))) > 0)
  )
);
create index expenses_shop_occurred_idx on public.expenses(shop_id, occurred_at desc);
create index expenses_shop_category_occurred_idx on public.expenses(shop_id, category, occurred_at desc);
comment on table public.expenses is
  'Recorded outgoing costs. Browser writes are intentionally withheld until a reviewed, auditable expense operation is implemented.';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  sale_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  payment_method text not null check (payment_method in ('cash', 'upi', 'card', 'bank_transfer', 'other')),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 1 and 160),
  external_reference text check (external_reference is null or char_length(external_reference) <= 200),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (shop_id, id),
  constraint payments_sale_shop_fk foreign key (shop_id, sale_id)
    references public.sales(shop_id, id) on delete restrict,
  constraint payments_shop_idempotency_unique unique (shop_id, idempotency_key)
);
create index payments_shop_sale_recorded_idx on public.payments(shop_id, sale_id, recorded_at desc);
create index payments_shop_recorded_idx on public.payments(shop_id, recorded_at desc);
comment on table public.payments is
  'A recorded collection, separate from a bill. No card number, security code, token, or other payment credential may be stored here.';
comment on column public.payments.external_reference is
  'Optional non-secret reference from a payment record; never store payment credentials or provider secrets.';

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid not null,
  sale_id uuid,
  points_delta integer not null check (points_delta <> 0),
  transaction_type text not null check (transaction_type in ('sale', 'redemption', 'adjustment_add', 'adjustment_deduct')),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (shop_id, id),
  constraint loyalty_customer_shop_fk foreign key (shop_id, customer_id)
    references public.customers(shop_id, id) on delete restrict,
  constraint loyalty_sale_customer_shop_fk foreign key (shop_id, sale_id, customer_id)
    references public.sales(shop_id, id, customer_id) on delete restrict,
  constraint loyalty_transaction_shape check (
    (transaction_type = 'sale' and sale_id is not null and points_delta > 0 and reason is null)
    or (transaction_type = 'redemption' and sale_id is not null and points_delta < 0)
    or (transaction_type = 'adjustment_add' and sale_id is null and points_delta > 0 and char_length(trim(coalesce(reason, ''))) > 0)
    or (transaction_type = 'adjustment_deduct' and sale_id is null and points_delta < 0 and char_length(trim(coalesce(reason, ''))) > 0)
  )
);
create unique index loyalty_sale_type_once_idx
  on public.loyalty_transactions(shop_id, sale_id, customer_id, transaction_type)
  where sale_id is not null;
create index loyalty_customer_created_idx
  on public.loyalty_transactions(shop_id, customer_id, created_at desc);
comment on table public.loyalty_transactions is
  'Authoritative points history. Customer loyalty_points is only a cache and must be updated in the same trusted operation.';

create table public.store_listings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid not null,
  published boolean not null default false,
  description text not null default '',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id),
  constraint store_listings_product_unique unique (shop_id, product_id),
  constraint store_listings_product_shop_fk foreign key (shop_id, product_id)
    references public.products(shop_id, id) on delete restrict,
  constraint store_listings_image_url_check check (
    image_url is null or (char_length(image_url) <= 2048 and image_url ~* '^https?://')
  )
);
create index store_listings_shop_published_idx on public.store_listings(shop_id, published);
comment on table public.store_listings is
  'Private listing metadata for existing products. It does not persist orders or copy product prices or stock.';

-- A sale movement must point to its sale. Purchase movements cannot yet point
-- to a purchase because this stage intentionally does not add a purchases table.
alter table public.inventory_movements
  add column created_by uuid references auth.users(id) on delete set null,
  add constraint inventory_sale_movement_requires_sale
    check (reason <> 'sale' or sale_id is not null) not valid;
create unique index inventory_sale_product_once_idx
  on public.inventory_movements(shop_id, sale_id, product_id)
  where reason = 'sale' and sale_id is not null;

-- Avoid RLS recursion and keep SECURITY DEFINER helpers outside the exposed
-- public schema. They only answer membership/role questions for the current JWT.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_shop_member(target_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.shop_members sm
    where sm.shop_id = target_shop_id
      and sm.user_id = (select auth.uid())
  );
$function$;
alter function private.is_shop_member(uuid) owner to postgres;
revoke all on function private.is_shop_member(uuid) from public, anon;
grant execute on function private.is_shop_member(uuid) to authenticated;

create or replace function private.has_shop_role(target_shop_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.shop_members sm
    where sm.shop_id = target_shop_id
      and sm.user_id = (select auth.uid())
      and sm.role = any (allowed_roles)
  );
$function$;
alter function private.has_shop_role(uuid, text[]) owner to postgres;
revoke all on function private.has_shop_role(uuid, text[]) from public, anon;
grant execute on function private.has_shop_role(uuid, text[]) to authenticated;

-- Harden and disable the original public helpers. Policies below use only the
-- private copies, preventing the old functions from serving as an RPC oracle.
alter function public.is_shop_member(uuid) owner to postgres;
alter function public.is_shop_member(uuid) set search_path = '';
revoke all on function public.is_shop_member(uuid) from public, anon, authenticated;
alter function public.has_shop_role(uuid, text[]) owner to postgres;
alter function public.has_shop_role(uuid, text[]) set search_path = '';
revoke all on function public.has_shop_role(uuid, text[]) from public, anon, authenticated;

-- Refresh the existing policies to use the hardened private membership helpers.
drop policy if exists shops_read_member on public.shops;
drop policy if exists shops_update_owner on public.shops;
create policy shops_read_member on public.shops for select to authenticated
  using (private.is_shop_member(id));
create policy shops_update_owner on public.shops for update to authenticated
  using (private.has_shop_role(id, array['owner']))
  with check (private.has_shop_role(id, array['owner']));

drop policy if exists shop_members_read_own_or_shop on public.shop_members;
create policy shop_members_read_own_or_shop on public.shop_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_shop_member(shop_id));

drop policy if exists customers_read_member on public.customers;
drop policy if exists customers_insert_manager on public.customers;
drop policy if exists customers_update_manager on public.customers;
drop policy if exists customers_delete_manager on public.customers;
create policy customers_read_member on public.customers for select to authenticated
  using (private.is_shop_member(shop_id));
create policy customers_insert_member on public.customers for insert to authenticated
  with check (private.has_shop_role(shop_id, array['owner', 'manager', 'staff']));
create policy customers_update_member on public.customers for update to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'manager', 'staff']))
  with check (private.has_shop_role(shop_id, array['owner', 'manager', 'staff']));
-- No direct delete policy: retain profiles referenced by sale/loyalty history.

drop policy if exists products_read_member on public.products;
drop policy if exists products_insert_manager on public.products;
drop policy if exists products_update_manager on public.products;
drop policy if exists products_delete_manager on public.products;
create policy products_read_member on public.products for select to authenticated
  using (private.is_shop_member(shop_id));
create policy products_insert_manager on public.products for insert to authenticated
  with check (private.has_shop_role(shop_id, array['owner', 'manager']) and stock_quantity = 0);
create policy products_update_manager on public.products for update to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'manager']))
  with check (private.has_shop_role(shop_id, array['owner', 'manager']));
-- No direct delete policy: archive products with active=false instead.

drop policy if exists sales_read_member on public.sales;
create policy sales_read_member on public.sales for select to authenticated
  using (private.is_shop_member(shop_id));
drop policy if exists sale_items_read_member on public.sale_items;
create policy sale_items_read_member on public.sale_items for select to authenticated
  using (private.is_shop_member(shop_id));
drop policy if exists inventory_movements_read_member on public.inventory_movements;
create policy inventory_movements_read_member on public.inventory_movements for select to authenticated
  using (private.is_shop_member(shop_id));

alter table public.expenses enable row level security;
alter table public.payments enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.store_listings enable row level security;

create policy expenses_read_member on public.expenses for select to authenticated
  using (private.is_shop_member(shop_id));
create policy payments_read_member on public.payments for select to authenticated
  using (private.is_shop_member(shop_id));
create policy loyalty_transactions_read_member on public.loyalty_transactions for select to authenticated
  using (private.is_shop_member(shop_id));
create policy store_listings_read_member on public.store_listings for select to authenticated
  using (private.is_shop_member(shop_id));
create policy store_listings_insert_manager on public.store_listings for insert to authenticated
  with check (private.has_shop_role(shop_id, array['owner', 'manager']));
create policy store_listings_update_manager on public.store_listings for update to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'manager']))
  with check (private.has_shop_role(shop_id, array['owner', 'manager']));
create policy store_listings_delete_manager on public.store_listings for delete to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'manager']));

-- Explicit grants complement RLS. Sensitive ledgers are read-only to browser
-- roles until trusted transactional operations are implemented and reviewed.
revoke all on table public.shops, public.shop_members,
  public.products, public.customers, public.sales, public.sale_items,
  public.inventory_movements, public.expenses, public.payments,
  public.loyalty_transactions, public.store_listings
  from public, anon, authenticated;

grant select on table public.shops, public.shop_members, public.products,
  public.customers, public.sales, public.sale_items, public.inventory_movements,
  public.expenses, public.payments, public.loyalty_transactions, public.store_listings
  to authenticated;

grant update (name, timezone, currency) on public.shops to authenticated;

grant insert (shop_id, sku, name, unit, sale_price_paise, cost_price_paise, tax_rate_bps, low_stock_threshold, active)
  on public.products to authenticated;
grant update (sku, name, unit, sale_price_paise, cost_price_paise, tax_rate_bps, low_stock_threshold, active)
  on public.products to authenticated;

grant insert (shop_id, name, phone, email) on public.customers to authenticated;
grant update (name, phone, email) on public.customers to authenticated;

grant insert (shop_id, product_id, published, description, image_url)
  on public.store_listings to authenticated;
grant update (published, description, image_url)
  on public.store_listings to authenticated;
grant delete on public.store_listings to authenticated;

-- Do not grant browser DML on sales, sale_items, payments, inventory movements,
-- loyalty transactions, or expenses. Future trusted operations must preserve
-- stock/ledger/cache invariants inside database transactions.

comment on column public.customers.loyalty_points is
  'Cached balance only. loyalty_transactions is the authoritative history; only a trusted transactional operation may change this balance.';
comment on column public.products.stock_quantity is
  'Cached whole-unit stock. Only a trusted operation may change this value together with inventory_movements.';
comment on column public.sales.discount_paise is
  'Sale-level discount as currently represented. Discount tax allocation and treatment remain an unresolved product/accounting decision.';
comment on table public.payments is
  'Rows represent recorded collections, not proof that a sale was paid merely because a sales row is completed.';
comment on column public.sales.source_order_id is
  'No online_orders table exists in this stage; do not treat this field as a persisted storefront order reference.';
