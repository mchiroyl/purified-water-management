ALTER TABLE sale ADD COLUMN company_legal_name VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE sale ADD COLUMN company_phone VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE sale ADD COLUMN company_whatsapp VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE sale ADD COLUMN company_email VARCHAR(254) NOT NULL DEFAULT '';
ALTER TABLE sale ADD COLUMN company_timezone VARCHAR(80) NOT NULL DEFAULT 'America/Guatemala';
ALTER TABLE sale ADD COLUMN company_logo_file_id UUID REFERENCES file_object(id);

ALTER TABLE sale DISABLE TRIGGER trg_sale_immutable;
UPDATE sale s SET
    company_legal_name=c.legal_name,
    company_phone=c.phone,
    company_whatsapp=c.whatsapp,
    company_email=c.email,
    company_timezone=c.timezone,
    company_logo_file_id=c.logo_file_id
FROM company_configuration c
WHERE c.singleton_key;
ALTER TABLE sale ENABLE TRIGGER trg_sale_immutable;

CREATE TABLE receipt_document (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL UNIQUE REFERENCES sale(id),
    file_id UUID NOT NULL UNIQUE REFERENCES file_object(id),
    document_kind VARCHAR(30) NOT NULL DEFAULT 'INTERNAL_RECEIPT',
    document_number VARCHAR(80) NOT NULL,
    generated_by UUID NOT NULL REFERENCES app_user(id),
    generated_device_id UUID NOT NULL REFERENCES device(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_receipt_document_kind CHECK (document_kind='INTERNAL_RECEIPT')
);

CREATE TABLE fel_document (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL UNIQUE REFERENCES sale(id),
    fel_configuration_id UUID NOT NULL REFERENCES fel_configuration(id),
    provider_code VARCHAR(100) NOT NULL,
    environment VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    request_reference VARCHAR(200),
    response_reference VARCHAR(200),
    certified_file_id UUID REFERENCES file_object(id),
    error_code VARCHAR(100),
    error_message VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    certified_at TIMESTAMPTZ,
    CONSTRAINT ck_fel_document_environment CHECK (environment IN ('TEST','PRODUCTION')),
    CONSTRAINT ck_fel_document_status CHECK (status IN ('PENDING','CERTIFIED','REJECTED')),
    CONSTRAINT ck_fel_document_result CHECK (
        (status='PENDING' AND certified_at IS NULL AND certified_file_id IS NULL AND error_code IS NULL)
        OR (status='CERTIFIED' AND certified_at IS NOT NULL AND certified_file_id IS NOT NULL AND error_code IS NULL)
        OR (status='REJECTED' AND certified_at IS NULL AND certified_file_id IS NULL AND error_code IS NOT NULL)
    )
);

INSERT INTO fel_configuration(singleton_key,enabled,environment)
VALUES (true,false,'TEST')
ON CONFLICT (singleton_key) DO NOTHING;

CREATE OR REPLACE FUNCTION protect_receipt_document() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'receipt documents are immutable' USING ERRCODE='55000';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_fel_document() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FEL documents cannot be deleted' USING ERRCODE='55000'; END IF;
    IF OLD.status IN ('CERTIFIED','REJECTED') THEN RAISE EXCEPTION 'final FEL documents are immutable' USING ERRCODE='55000'; END IF;
    IF (NEW.id,NEW.sale_id,NEW.fel_configuration_id,NEW.provider_code,NEW.environment,NEW.created_at)
       IS DISTINCT FROM (OLD.id,OLD.sale_id,OLD.fel_configuration_id,OLD.provider_code,OLD.environment,OLD.created_at) THEN
        RAISE EXCEPTION 'FEL document identity is immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_receipt_document_immutable BEFORE UPDATE OR DELETE ON receipt_document
FOR EACH ROW EXECUTE FUNCTION protect_receipt_document();
CREATE TRIGGER trg_fel_document_protected BEFORE UPDATE OR DELETE ON fel_document
FOR EACH ROW EXECUTE FUNCTION protect_fel_document();
