ALTER TABLE company_configuration
    ALTER COLUMN currency_code TYPE VARCHAR(3)
    USING trim(currency_code);
