ALTER TABLE settlement
    ADD COLUMN IF NOT EXISTS sales_cash NUMERIC(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS credit_collections_cash NUMERIC(18,2) NOT NULL DEFAULT 0;

UPDATE settlement
SET sales_cash = expected_cash,
    credit_collections_cash = 0
WHERE sales_cash = 0 AND expected_cash > 0;
