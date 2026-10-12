-- V48: Performance indexes for high-throughput reads (sales, settlements, blockers)
-- Following Supabase Postgres Best Practices (query-missing-indexes, query-composite-indexes)

-- 1. Sales filters and pagination
CREATE INDEX IF NOT EXISTS idx_sale_created_by
    ON sale(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_pagination
    ON sale(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_sale_status_route_time
    ON sale(route_id, status, created_at);

-- 2. Route assignments and loads
CREATE INDEX IF NOT EXISTS idx_route_load_seller
    ON route_load(seller_received_by);

CREATE INDEX IF NOT EXISTS idx_route_assignment_seller
    ON route_assignment(seller_id, route_id);

CREATE INDEX IF NOT EXISTS idx_route_assignment_route_valid
    ON route_assignment(route_id, valid_from, valid_to);

-- 3. Annulment requests (frequently queried via EXISTS/JOIN in sales & settlements)
CREATE INDEX IF NOT EXISTS idx_annulment_request_sale_status
    ON annulment_request(sale_id, status);

-- 4. Customer return items & settlement sub-queries
CREATE INDEX IF NOT EXISTS idx_return_item_product
    ON return_item(product_id);

CREATE INDEX IF NOT EXISTS idx_customer_return_route_time
    ON customer_return(route_id, status, received_at_server);

-- 5. Waste items & settlement blockers
CREATE INDEX IF NOT EXISTS idx_waste_route_time
    ON waste(route_id, status, received_at_server);

-- 6. Sync operations in settlement blockers
CREATE INDEX IF NOT EXISTS idx_sync_op_user_received
    ON sync_operation(user_id, received_at_server);

-- 7. Payment lookup by sale and method
CREATE INDEX IF NOT EXISTS idx_payment_sale_method_status
    ON payment(sale_id, payment_method, status);

-- 8. Settlement items & cash delivery ordering
CREATE INDEX IF NOT EXISTS idx_settlement_item_settlement
    ON settlement_item(settlement_id);

CREATE INDEX IF NOT EXISTS idx_cash_delivery_load_time
    ON cash_delivery(route_load_id, delivered_at DESC);

-- 9. Customer registration blockers
CREATE INDEX IF NOT EXISTS idx_customer_review_pending
    ON customer(created_by, registration_state, created_at);

-- 10. Credit payments collected by seller
CREATE INDEX IF NOT EXISTS idx_credit_payment_collected_time
    ON credit_payment(collected_by, created_at);
