# Tax preparation

Owned by Developer 3. `/tax` reads completed demo sales and their sale-item snapshots from `demoDataSource`. The period summary includes only unique completed sales. Taxable value and recorded tax estimates are included only for sales whose item subtotal/tax snapshots reconcile with the stored sale. The values are pre-discount because the demo checkout records product tax before loyalty discounts.

The GST calculator supports 0%, 5%, 12%, 18% and 28% for GST-inclusive or GST-exclusive amounts and rounds in integer paise. CSV export is a preparation summary, not a GST return.

The current data model does not record shop/customer GSTIN, HSN/SAC, place of supply, supply state, jurisdictional split, or filing status. CGST/SGST versus IGST is therefore unavailable. This feature does not provide professional tax advice or automated filing and operates only on local browser demo data.
