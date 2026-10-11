# Inventory

Owned by Developer 1. Use `Product` and `InventoryMovement` from the shared domain contract. The demo catalog supports add/edit, low-stock visibility and validated auditable stock adjustments. POS sales update this same browser-local catalog and add sale-linked movements.

Demo changes persist in local storage and are not live database writes. Live stock adjustments and sale deductions must use reviewed, shop-authorized database operations; checkout is expected to use the pending atomic `process_sale` RPC.
