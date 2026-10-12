# Customers and loyalty

Owned by Developer 2. Import `Customer`, `Sale`, and `SaleItem` from `src/types/domain.ts`; the demo customer list and history use the shared demo data adapter. Customer edits persist with the rest of the demo business snapshot and appear in POS customer selection.

## Demo rewards and adjustments

New customers start at zero points. Award **1 point per full ₹100 of the completed POS bill actually paid after loyalty discounts** (`floor(finalTotalPaise / 10,000)`). The shared demo sale operation writes the sale, customer balance, and sale-earned loyalty transaction together in the same browser-local snapshot. Retrying an idempotency key returns the existing sale before applying any second inventory or loyalty change. Cancelled or incomplete checkouts do not reach this operation and earn no points. Lifetime spending and purchase count are derived from completed sales associated with a customer.

Staff can add or deduct a positive whole number of points from a customer profile. A reason is required, deductions cannot exceed the current balance, and a confirmation step precedes the change. Each adjustment is stored as a separate loyalty transaction with direction, amount, reason, customer, and timestamp; profile history keeps those adjustments separate from sale-earned points.

The first load of an older demo snapshot performs a one-time migration of the original fixed sample balances (420 and 285 points) for the two seeded customer IDs. It removes only the known seed baseline when the stored balance is explained by that baseline plus its existing loyalty ledger, or when the balance is exactly the seed value with no purchase or loyalty history. Other balances and history are retained. Fresh demo customers start at zero. This is browser-local demonstration behavior, not cross-device storage, a live loyalty service, or a database transaction. Production must use the reviewed atomic `process_sale` RPC and server-side authorization before connecting to Supabase.
