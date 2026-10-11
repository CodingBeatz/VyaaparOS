# VyapaarOS team handoff

## Shared rules

- `src/types/domain.ts` is the only canonical TypeScript business model. Import types; do not copy or reshape them inside feature folders.
- All money in business logic is integer paise (`Paise`). Convert to rupees only in presentation helpers in `src/lib/format.ts`.
- Every persisted business record is scoped to a `shopId` / database `shop_id`.
- The demo adapter is `src/lib/data/demoDataSource.ts`; sample records live in `src/lib/data/demo.ts`. Do not mix demo objects into a future Supabase adapter.
- The `process_sale` database RPC is pending. Do not let clients directly mutate stock or create completed sales before its transaction and access policies are implemented and reviewed.

## Developer 1 — Foundation, billing, inventory, integration

**Owns:**

- `src/App.tsx` route registration and application shell.
- `src/components/` shared UI components and `src/index.css` shared tokens/component styles.
- `src/types/domain.ts` canonical shared model and RPC input/output contracts.
- `src/lib/` shared Supabase client, data-source wiring, format and validation helpers.
- `src/features/billing/` and `src/features/inventory/`.
- `supabase/migrations/` and database integration notes.
- Integration and final application build.

**Contract to publish early:** `ProcessSaleInput`, `ProcessSaleResult`, and route entry points for billing/inventory. Implement checkout through one reviewed database transaction, not a series of frontend writes.

## Developer 2 — Customers, loyalty, storefront, online orders

**Owns:**

- `src/features/customers/` customer list/profile and loyalty history screens.
- `src/features/storefront/` shareable catalog and online order screens.
- Tests or fixtures confined to these modules when the team adds them.

**Uses:** `Customer`, `LoyaltyTransaction`, `OnlineOrder`, `Product`, and `ProcessSaleInput` from `src/types/domain.ts`. Storefront completion must route through the shared sale transaction. Payment remains a transparent demo/manual status until a real provider is approved and integrated.

**Avoids editing:** app shell, canonical shared types, common styles, Supabase client, and SQL migrations. Request contract changes from Developer 1.

## Developer 3 — Finance, cash flow, tax, reporting

**Owns:**

- `src/features/finance/` income/expense views and cash-flow estimate.
- `src/features/tax/` preparation summaries and reminders.
- `src/features/dashboard/` dashboard cards, chart and reporting presentation after coordinating route ownership with Developer 1.
- Module-local view components and presentation logic.

**Uses:** `FinancialEntry`, `Purchase`, `TaxReminder`, `Sale`, `SaleItem`, and shared paise/date formatting. Forecast assumptions should be shown plainly; tax output is informational and never presented as guaranteed legal advice or automated filing.

**Avoids editing:** canonical shared types, app shell, common styles, Supabase client, and SQL migrations. Request data or route changes from Developer 1.

## Integration order

1. Developer 1 keeps route placeholders and shared contract stable.
2. Developers 2 and 3 work within their feature folders against the contract and demo adapter.
3. Agree on schema additions before Developer 1 creates migrations; do not create competing table definitions.
4. Merge short-lived branches through pull requests, build after each integration, and leave the last hour for end-to-end demo rehearsal.
