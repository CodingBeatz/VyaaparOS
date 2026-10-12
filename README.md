# VyapaarOS

VyapaarOS is a hackathon prototype for neighbourhood retailers. It brings daily sales, inventory, customer loyalty, online orders, finance and tax preparation into one shop-scoped workspace.

## Run locally

Requirements: Node.js 22.13.0 or newer, and npm 10+ to install the pinned pnpm version. `package.json` pins pnpm 11.25.0; the lockfile is `pnpm-lock.yaml`.

```powershell
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The app works in demo mode without any backend account or environment file.

## Environment configuration

Copy `.env.example` to `.env.local` if you have a Supabase project, then replace the placeholders with the project URL and public anon key:

```powershell
Copy-Item .env.example .env.local
```

Only `VITE_SUPABASE_URL` and the publishable/anon key belong in this browser app. Never add a Supabase service-role key or any other secret to a `VITE_*` variable. `.env` and `.env.*` files are ignored by Git; `.env.example` contains placeholders only.

This milestone does **not** connect screens to Supabase, implement sign-in/onboarding, or write business records to the backend. The UI explicitly uses sample data even if Supabase environment variables are present. The browser-safe client is only a configured client seam for the next milestone. It does not make the database policies or future RPC tested or secure by itself.

## Demo mode

The dashboard and POS, inventory, and customer screens use `src/lib/data/demoDataSource.ts`, backed by clearly labeled sample data in `src/lib/data/demo.ts`. POS, inventory, and customer changes persist in browser local storage and are shared across those demo screens. This adapter is independent from `src/lib/supabase/client.ts`; demo reads and writes never fall through to a live backend. No payment, tax filing, or AI integration is connected. Tax dates and amounts are preparation examples, not legal or filing advice.

## Implementation status

- **Implemented:** responsive application shell and seven routes; demo dashboard; interactive demo POS, inventory, customer list/profile/history, finance expense/transaction views, online listing management with a private storefront/cart preview, and a tax preparation summary with GST estimate calculator and CSV export; shared domain types, formatting and validation helpers; optional browser-safe Supabase client configuration; initial SQL schema migration.
- **Placeholders:** online order placement and jurisdictional GST split/filing workflow. Dashboard reminders remain sample preparation reminders. Finance gross profit is not calculated because historical product costs are not snapshotted on sale items. Tax outputs are demo estimates, not official returns or filing advice.
- **Incomplete integrations:** Supabase authentication/onboarding and live data adapters; the `process_sale` RPC; payment processing; AI assistance; GST liability calculation from jurisdictional data and GST filing. The migration has not been applied to a Supabase project or security-tested.

## Production build

```powershell
pnpm build
pnpm preview
```

Run the focused finance summary tests with `pnpm test` (Node.js 22.13+).

## Project structure

```text
src/
  App.tsx                    # responsive shell and route table
  components/ui/             # shared demo status and notice components
  index.css                  # Tailwind v4 entry plus design tokens/components
  types/domain.ts            # single shared business contract (paise for money)
  lib/format.ts              # Indian currency/date formatting
  lib/validation.ts          # input parsing and basic validation
  lib/data/demo.ts           # sample-only data
  lib/data/demoDataSource.ts  # demo UI data adapter
  lib/supabase/client.ts      # optional browser client, anon key only
  features/
    dashboard/               # demo dashboard and reporting presentation
    billing/ inventory/      # Developer 1
    customers/ storefront/   # Developer 2
    finance/ tax/            # Developer 3
supabase/migrations/         # initial schema; review and test before applying
```

Tailwind CSS v4 is integrated through `@tailwindcss/vite`. React Router handles the seven working routes. Recharts powers the dashboard sales chart.

## Shared business contract

All canonical interfaces live in `src/types/domain.ts`; feature modules should import these instead of defining copies. Paise values use the `Paise` alias and must remain safe integer numbers in TypeScript. Database monetary columns are `bigint` paise. Sale item records carry product name, unit price, tax rate and line-total snapshots so later catalog edits do not rewrite bill history.

The SQL migration establishes shops, memberships, customers, products, sales, sale items and inventory movements. The shared TypeScript contract also reserves online orders, purchases, loyalty transactions, financial entries and tax reminders; those tables and their policies belong in follow-up migrations before their live modules are connected.

### Planned `process_sale` RPC (pending)

The intended RPC accepts `ProcessSaleInput` from `src/types/domain.ts`: shop, optional customer, POS/online source, optional source order, an idempotency key, product/quantity lines, and an optional discount in paise. It should authorize the authenticated shop member, validate safe non-negative paise and positive quantities, re-read prices/tax from the database, lock product rows, reject insufficient stock, and verify customer/order ownership. In a single PostgreSQL transaction it should insert the sale and item snapshots, decrement stock, add inventory movements, add loyalty points and create the income ledger entry; the online order should be marked complete if applicable. A unique `(shop_id, idempotency_key)` makes safe retries possible. It returns `ProcessSaleResult`.

**The RPC is not implemented or validated in this milestone.** Sales/stock ledger tables currently have member read policies and intentionally no direct write policies. Do not enable live checkout until the RPC, RLS, role rules, transaction behavior and concurrency cases have been reviewed and tested.

## Authentication and authorization assumptions

- Supabase Auth user IDs are the `shop_members.user_id` values.
- Every tenant-owned record includes a `shop_id`; cross-shop links are constrained with composite foreign keys where present.
- Authenticated users can read their own shop membership; shop resources are visible only to members.
- Shop creation and initial owner membership must happen through a trusted onboarding flow. This migration intentionally has no client-side shop/member insert policy, so onboarding remains to be implemented.
- Owners/managers can manage catalog products; staff can read products and record customers. Sale, item and inventory ledger writes await the authorized atomic RPC.
- The migration uses fixed-search-path `SECURITY DEFINER` membership helper functions to avoid recursive membership-table policies. Those helpers, policies, and the migration still require a security review and database testing before production claims.

## Feature ownership

- **Developer 1:** app foundation, shared types, Supabase/migrations, billing, inventory, integration.
- **Developer 2:** `src/features/customers/` and `src/features/storefront/` for customer profiles, loyalty, storefront and online orders.
- **Developer 3:** `src/features/finance/`, `src/features/tax/` and `src/features/dashboard/` for finance, cash-flow estimates, tax preparation reminders and reporting.

The demo loyalty rules are 100 points for a ₹10 POS checkout discount and 1 point per full ₹100 of the final bill paid after discounts; details and limitations are documented in `src/features/customers/README.md`.

Feature folders already exist with initial handoff notes. Import models from `src/types/domain.ts`; do not redefine them. App shell, shared types, `src/lib/` and migrations are Developer 1-owned interfaces—coordinate changes before editing.

## Team Git workflow

Keep `main` as the stable integration branch. After the initial foundation commit is approved and pushed, each developer works on a short-lived branch from `main`, opens a small pull request early, and syncs frequently. Integrate shared contracts and migrations first; have Developer 1 review and sequence database changes. Keep feature edits in owned folders, avoid parallel changes to shared types/migrations, and reserve the final hour for a clean build and demo walkthrough. Never commit secrets or `.env.local`.
