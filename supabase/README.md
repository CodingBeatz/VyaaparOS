# Supabase database setup

The versioned SQL files in `supabase/migrations/` define the database schema. The new schema foundation is not automatically applied, and this repository is not linked to a Supabase project by this stage.

## Local development database

The repository currently has no `supabase/config.toml`. On a development machine with Docker available, initialize the local Supabase project once, review the generated configuration, then start and migrate the local database:

```powershell
npx supabase init
npx supabase start
npx supabase migration up --local
```

`migration up --local` applies all unapplied local migrations, including the initial foundation migration. Do not use `--linked`, `--db-url`, or `db push` for this local workflow. This stage did not run any migration-application command or connect to a database.

Keep only intended schemas exposed through the Supabase Data API. The `private` schema contains membership helper functions used by RLS and should remain unexposed. Never put a service-role key or database password in a `VITE_*` variable or source file.

## Security and implementation status

- Shop data is scoped with `shop_id`, RLS membership checks, and same-shop foreign keys.
- Sales, sale items, payments, inventory movements, loyalty transactions, and expenses have no browser write grants in this foundation. Trusted database transactions/RPCs are not implemented here.
- Product stock and customer loyalty points are cached values. Future trusted operations must update each cache and its append-only ledger in the same database transaction.
- Sales represent bills. Payment rows represent separately recorded collections. No card credentials, fake online orders, or payment records are generated.
- Membership helper functions use a non-exposed schema, a fixed empty search path, explicit `auth.uid()` checks, restricted execution, and the `postgres` owner. Review and test these functions and policies in a local Supabase database before any live use.
- Existing demo/localStorage records are not imported or changed.

## Decisions still open

The schema does not decide discount-to-tax allocation, GST-inclusive versus exclusive pricing policy, refunds/voids, jurisdictional GST details, customer contact deduplication, or online-order persistence. Existing fractional quantities are not coerced: whole-unit checks are added `NOT VALID` and should be validated after confirming no fractional data exists.
