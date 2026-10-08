-- V45: Index unindexed foreign keys and optimize aggregation performance
-- Following Supabase Postgres Best Practices (index-foreign-keys, query-indexes)

-- 1. Sales and Sales Items
CREATE INDEX IF NOT EXISTS idx_sale_item_sale_id ON sale_item(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_item_presentation_id ON sale_item(presentation_id);

-- 2. Credit and Accounts
CREATE INDEX IF NOT EXISTS idx_credit_account_entry_sale_id ON credit_account_entry(sale_id);
CREATE INDEX IF NOT EXISTS idx_credit_payment_route_load ON credit_payment(route_load_id);

-- 3. Settlements and Cash Deliveries
CREATE INDEX IF NOT EXISTS idx_cash_delivery_route_load ON cash_delivery(route_load_id);
CREATE INDEX IF NOT EXISTS idx_cash_delivery_delivered_by ON cash_delivery(delivered_by);
CREATE INDEX IF NOT EXISTS idx_cash_delivery_received_by ON cash_delivery(received_by);
CREATE INDEX IF NOT EXISTS idx_settlement_route_id ON settlement(route_id);

-- 4. Jug Loans and Containers
CREATE INDEX IF NOT EXISTS idx_jug_loan_sale_id ON jug_loan_event(sale_id);
CREATE INDEX IF NOT EXISTS idx_jug_loan_route_load_id ON jug_loan_event(route_load_id);
CREATE INDEX IF NOT EXISTS idx_jug_loan_balance_covering ON jug_loan_event(customer_id, route_id, event_type, quantity);
