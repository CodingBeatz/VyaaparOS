# Online storefront and orders

Owned by Developer 2. Import `OnlineOrder`, `Product`, and the shared sale contract. Orders may be demo/manual status only; do not imply a payment provider is connected. Fulfillment must call the same `process_sale` path as POS.

Online Store is demo-only and uses product records from `demoDataSource`. Listing descriptions, optional image URLs, and publication state are persisted separately from inventory price and stock. The in-app preview filters published items and the basket validates current demo stock and calculates integer-paise totals, including estimated tax. Checkout is intentionally unavailable: no online orders, completed sales, payment, or public storefront are created by this preview.

The catalog has no canonical category field yet; the screen derives simple category filters from product names and SKUs for the prototype. Treat those labels as indicative until the shared product contract gains an explicit category.
