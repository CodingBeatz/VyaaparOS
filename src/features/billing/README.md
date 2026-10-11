# Billing / POS

Owned by Developer 1. The demo register uses the shared `ProcessSaleInput` / `ProcessSaleResult` contract and the demo-only business adapter. It records a local receipt, sale-item snapshots, stock movements, loyalty points and a demo finance entry together in the browser's demo snapshot.

This does not call the pending `process_sale` RPC, collect a payment, or create a live database transaction. Before enabling live checkout, route the feature through the reviewed atomic RPC; do not replace it with separate frontend writes for stock, loyalty or finance.
