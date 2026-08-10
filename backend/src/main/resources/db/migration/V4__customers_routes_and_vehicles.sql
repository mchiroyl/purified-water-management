CREATE TABLE vehicle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    license_plate VARCHAR(20) UNIQUE,
    description VARCHAR(200) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_vehicle_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE route (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_route_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE route_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES route(id),
    seller_id UUID NOT NULL REFERENCES seller(id),
    vehicle_id UUID REFERENCES vehicle(id),
    valid_from DATE NOT NULL,
    valid_to DATE,
    assigned_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_route_assignment_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX uq_route_assignment_open_route ON route_assignment(route_id) WHERE valid_to IS NULL;
CREATE INDEX idx_route_assignment_seller_dates ON route_assignment(seller_id, valid_from, valid_to);

CREATE TABLE customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    normalized_name VARCHAR(180) NOT NULL,
    contact_name VARCHAR(150) NOT NULL DEFAULT '',
    phone VARCHAR(30) NOT NULL DEFAULT '',
    normalized_phone VARCHAR(30) NOT NULL DEFAULT '',
    whatsapp VARCHAR(30) NOT NULL DEFAULT '',
    normalized_whatsapp VARCHAR(30) NOT NULL DEFAULT '',
    address_reference TEXT NOT NULL,
    customer_type VARCHAR(30) NOT NULL DEFAULT 'PERMANENT',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    credit_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_by UUID REFERENCES app_user(id),
    source_device_id UUID REFERENCES device(id),
    registration_state VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_customer_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_customer_type CHECK (customer_type IN ('PERMANENT', 'PROVISIONAL')),
    CONSTRAINT ck_customer_registration CHECK (registration_state IN ('ACTIVE', 'PROVISIONAL_LOCAL', 'PENDING_SYNC', 'PENDING_REVIEW', 'MERGED', 'REJECTED_FOR_REGISTRATION')),
    CONSTRAINT ck_customer_credit CHECK (credit_limit >= 0 AND current_balance >= 0 AND (credit_allowed OR credit_limit = 0))
);

CREATE INDEX idx_customer_normalized_name ON customer(normalized_name);
CREATE INDEX idx_customer_normalized_phone ON customer(normalized_phone) WHERE normalized_phone <> '';
CREATE INDEX idx_customer_normalized_whatsapp ON customer(normalized_whatsapp) WHERE normalized_whatsapp <> '';

CREATE TABLE customer_route (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    route_id UUID NOT NULL REFERENCES route(id),
    valid_from DATE NOT NULL,
    valid_to DATE,
    assigned_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_customer_route_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX uq_customer_route_open_customer ON customer_route(customer_id) WHERE valid_to IS NULL;
CREATE INDEX idx_customer_route_route_dates ON customer_route(route_id, valid_from, valid_to);
