-- V50__daily_ordered_itineraries.sql
-- Migración aditiva para soporte de recorridos ordenados por administración,
-- ubicaciones confirmadas de clientes, plantillas de ruta e itinerarios inmutables de jornada.
-- Diseñado bajo las mejores prácticas de Supabase Postgres (FKs indexadas, checks, tipos seguros).

-- 1. Ubicación confirmada y validada por el administrador para clientes
CREATE TABLE customer_confirmed_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    latitude NUMERIC(12,8) NOT NULL,
    longitude NUMERIC(12,8) NOT NULL,
    accuracy_meters NUMERIC(10,2),
    source_type VARCHAR(40) NOT NULL DEFAULT 'ADMIN_MANUAL',
    source_reference_id UUID,
    confirmed_by UUID NOT NULL REFERENCES app_user(id),
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes VARCHAR(300) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT ck_ccl_status CHECK (status IN ('ACTIVE', 'SUPERSEDED')),
    CONSTRAINT ck_ccl_latitude CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT ck_ccl_longitude CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT ck_ccl_accuracy CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0)
);

CREATE UNIQUE INDEX uq_customer_confirmed_location_active
    ON customer_confirmed_location(customer_id)
    WHERE status = 'ACTIVE';

CREATE INDEX idx_ccl_customer_id ON customer_confirmed_location(customer_id);
CREATE INDEX idx_ccl_confirmed_by ON customer_confirmed_location(confirmed_by);
CREATE INDEX idx_ccl_source_ref ON customer_confirmed_location(source_reference_id)
    WHERE source_reference_id IS NOT NULL;

-- 2. Plantilla Maestra de Ruta (Definición del orden habitual 1..N y punto de partida)
CREATE TABLE route_plan_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES route(id),
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_latitude NUMERIC(12,8) NOT NULL,
    start_longitude NUMERIC(12,8) NOT NULL,
    start_address_reference VARCHAR(250) NOT NULL DEFAULT 'Bodega / Planta Central',
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_rpt_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_rpt_start_latitude CHECK (start_latitude >= -90 AND start_latitude <= 90),
    CONSTRAINT ck_rpt_start_longitude CHECK (start_longitude >= -180 AND start_longitude <= 180),
    CONSTRAINT ck_rpt_version CHECK (version > 0)
);

CREATE INDEX idx_rpt_route_id ON route_plan_template(route_id);
CREATE INDEX idx_rpt_created_by ON route_plan_template(created_by);
CREATE INDEX idx_rpt_status ON route_plan_template(status);

-- Paradas ordenadas dentro de la plantilla maestra
CREATE TABLE route_plan_template_stop (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES route_plan_template(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customer(id),
    stop_order INTEGER NOT NULL,
    instructions VARCHAR(300) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_rpt_stop_order UNIQUE (template_id, stop_order),
    CONSTRAINT uq_rpt_stop_customer UNIQUE (template_id, customer_id),
    CONSTRAINT ck_rpt_stop_order_positive CHECK (stop_order > 0)
);

CREATE INDEX idx_rpts_template_id ON route_plan_template_stop(template_id);
CREATE INDEX idx_rpts_customer_id ON route_plan_template_stop(customer_id);

-- 3. Itinerario de Jornada Operativa (Snapshot congelado por día y carga de ruta)
CREATE TABLE daily_itinerary_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES route(id),
    route_load_id UUID NOT NULL UNIQUE REFERENCES route_load(id),
    template_id UUID REFERENCES route_plan_template(id),
    operational_date DATE NOT NULL,
    seller_id UUID NOT NULL REFERENCES seller(id),
    vehicle_id UUID REFERENCES vehicle(id),
    start_latitude NUMERIC(12,8) NOT NULL,
    start_longitude NUMERIC(12,8) NOT NULL,
    start_address_reference VARCHAR(250) NOT NULL DEFAULT 'Bodega / Planta Central',
    published_polyline TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED',
    total_planned_stops INTEGER NOT NULL DEFAULT 0,
    attended_stops INTEGER NOT NULL DEFAULT 0,
    postponed_stops INTEGER NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    published_by UUID NOT NULL REFERENCES app_user(id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_by UUID REFERENCES app_user(id),
    closed_at TIMESTAMPTZ,
    closure_reason VARCHAR(300),
    CONSTRAINT ck_dir_status CHECK (status IN (
        'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED_INCOMPLETE', 'CANCELLED'
    )),
    CONSTRAINT ck_dir_start_latitude CHECK (start_latitude >= -90 AND start_latitude <= 90),
    CONSTRAINT ck_dir_start_longitude CHECK (start_longitude >= -180 AND start_longitude <= 180),
    CONSTRAINT ck_dir_stops_count CHECK (
        total_planned_stops >= 0 AND attended_stops >= 0 AND postponed_stops >= 0
    )
);

CREATE INDEX idx_dir_route_id ON daily_itinerary_run(route_id);
CREATE INDEX idx_dir_route_load_id ON daily_itinerary_run(route_load_id);
CREATE INDEX idx_dir_template_id ON daily_itinerary_run(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX idx_dir_seller_date ON daily_itinerary_run(seller_id, operational_date);
CREATE INDEX idx_dir_vehicle_id ON daily_itinerary_run(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_dir_published_by ON daily_itinerary_run(published_by);
CREATE INDEX idx_dir_closed_by ON daily_itinerary_run(closed_by) WHERE closed_by IS NOT NULL;

-- 4. Parada de Jornada Operativa (Snapshot inmutable de datos del cliente y estado de ejecución)
CREATE TABLE daily_itinerary_stop (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_run_id UUID NOT NULL REFERENCES daily_itinerary_run(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customer(id),
    planned_order INTEGER NOT NULL,
    customer_name_snapshot VARCHAR(180) NOT NULL,
    address_reference_snapshot TEXT NOT NULL DEFAULT '',
    target_latitude NUMERIC(12,8) NOT NULL,
    target_longitude NUMERIC(12,8) NOT NULL,
    accuracy_meters NUMERIC(10,2),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    execution_order INTEGER,
    completed_at TIMESTAMPTZ,
    sale_id UUID REFERENCES sale(id),
    no_purchase_reason VARCHAR(50),
    postponed_reason VARCHAR(50),
    notes VARCHAR(300) NOT NULL DEFAULT '',
    observed_latitude NUMERIC(12,8),
    observed_longitude NUMERIC(12,8),
    observed_accuracy_meters NUMERIC(10,2),
    distance_deviation_meters NUMERIC(10,2),
    has_location_mismatch BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_itinerary_planned_order UNIQUE (itinerary_run_id, planned_order),
    CONSTRAINT uq_itinerary_customer UNIQUE (itinerary_run_id, customer_id),
    CONSTRAINT ck_dis_status CHECK (status IN (
        'PENDING', 'ATTENDED_SALE', 'ATTENDED_NO_PURCHASE', 'POSTPONED_BLOCKED', 'CANCELLED'
    )),
    CONSTRAINT ck_dis_target_lat CHECK (target_latitude >= -90 AND target_latitude <= 90),
    CONSTRAINT ck_dis_target_lon CHECK (target_longitude >= -180 AND target_longitude <= 180),
    CONSTRAINT ck_dis_planned_order CHECK (planned_order > 0)
);

CREATE INDEX idx_dis_itinerary_run_id ON daily_itinerary_stop(itinerary_run_id);
CREATE INDEX idx_dis_customer_id ON daily_itinerary_stop(customer_id);
CREATE INDEX idx_dis_sale_id ON daily_itinerary_stop(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX idx_dis_status ON daily_itinerary_stop(itinerary_run_id, status);

-- 5. Vincular formalmente la venta a la carga y al itinerario, soportando venta programada y banderas de desvío
ALTER TABLE sale ADD COLUMN itinerary_run_id UUID REFERENCES daily_itinerary_run(id);
ALTER TABLE sale ADD COLUMN route_load_id UUID REFERENCES route_load(id);
ALTER TABLE sale ADD COLUMN is_itinerary_planned BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE sale ADD COLUMN location_mismatch BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_sale_itinerary_run_id ON sale(itinerary_run_id) WHERE itinerary_run_id IS NOT NULL;
CREATE INDEX idx_sale_route_load_id ON sale(route_load_id) WHERE route_load_id IS NOT NULL;
CREATE INDEX idx_sale_mismatch ON sale(route_id, location_mismatch) WHERE location_mismatch = TRUE;
