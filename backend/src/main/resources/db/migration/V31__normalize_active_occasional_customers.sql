-- Normalize legacy occasional customers after the occasional-registration flow was retired.
UPDATE customer
SET customer_type = 'PERMANENT',
    registration_state = 'ACTIVE',
    code = 'CLI-' || lpad(nextval('customer_code_seq')::text, 6, '0'),
    updated_at = now()
WHERE customer_type = 'OCCASIONAL'
  AND status = 'ACTIVE';
