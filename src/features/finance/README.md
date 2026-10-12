# Finance and cash flow

Owned by Developer 3. Use `FinancialEntry`, `Purchase`, and `Sale` from the shared domain contract. Finance reads completed sales and persisted manual expense entries from `demoDataSource`; do not create sample transactions to fill charts. Expense amounts stay in integer paise and persist in this browser's demo snapshot.

The overview reports completed sale totals, recorded manual expenses, and their difference as **recorded cash flow**. It is not a net profit or cash balance. Gross profit is unavailable because `SaleItem` does not snapshot cost at time of sale; current catalog cost can change and is not a reliable historic basis. There is no live Supabase connection, accounting integration, or export in this feature.
