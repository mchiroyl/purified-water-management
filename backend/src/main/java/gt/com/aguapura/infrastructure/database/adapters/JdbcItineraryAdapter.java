package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.ItineraryPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcItineraryAdapter implements ItineraryPort {

    private final JdbcClient jdbc;

    public JdbcItineraryAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void saveCustomerConfirmedLocation(ConfirmedLocationView loc) {
        jdbc.sql("""
                UPDATE customer_confirmed_location
                SET status = 'SUPERSEDED'
                WHERE customer_id = :customerId AND status = 'ACTIVE'
                """).param("customerId", loc.customerId()).update();

        jdbc.sql("""
                INSERT INTO customer_confirmed_location (
                    id, customer_id, latitude, longitude, accuracy_meters,
                    source_type, source_reference_id, confirmed_by, confirmed_at, notes, status
                ) VALUES (
                    :id, :customerId, :latitude, :longitude, CAST(:accuracyMeters AS numeric),
                    :sourceType, CAST(:sourceRefId AS uuid), :confirmedBy, CAST(:confirmedAt AS timestamptz), :notes, 'ACTIVE'
                )
                """)
                .param("id", loc.id() != null ? loc.id() : UUID.randomUUID())
                .param("customerId", loc.customerId())
                .param("latitude", loc.latitude())
                .param("longitude", loc.longitude())
                .param("accuracyMeters", loc.accuracyMeters())
                .param("sourceType", loc.sourceType() != null ? loc.sourceType() : "ADMIN_MANUAL")
                .param("sourceRefId", loc.sourceReferenceId())
                .param("confirmedBy", loc.confirmedBy())
                .param("confirmedAt", loc.confirmedAt() != null 
                        ? loc.confirmedAt().atOffset(java.time.ZoneOffset.UTC) 
                        : java.time.OffsetDateTime.now())
                .param("notes", loc.notes() != null ? loc.notes() : "")
                .update();
    }

    @Override
    public Optional<ConfirmedLocationView> findCustomerConfirmedLocation(UUID customerId) {
        return jdbc.sql("""
                SELECT id, customer_id, latitude, longitude, accuracy_meters,
                       source_type, source_reference_id, confirmed_by, confirmed_at, notes, status
                FROM customer_confirmed_location
                WHERE customer_id = :customerId AND status = 'ACTIVE'
                LIMIT 1
                """)
                .param("customerId", customerId)
                .query((rs, rowNum) -> mapConfirmedLocation(rs))
                .optional();
    }

    @Override
    public List<CustomerHistoricalPointView> findCustomerHistoricalPoints(UUID customerId) {
        return jdbc.sql("""
                SELECT p.id, p.point_type, p.latitude, p.longitude, p.accuracy_meters, p.captured_at,
                       COALESCE(s.document_number, p.visit_note, 'Punto inicial') AS ref_text
                FROM route_tracking_point p
                LEFT JOIN sale s ON s.id = p.sale_id
                WHERE (p.point_type = 'NO_PURCHASE_VISIT' AND p.customer_id = :customerId)
                   OR (p.point_type = 'SALE' AND s.customer_id = :customerId)
                ORDER BY p.captured_at DESC
                LIMIT 25
                """)
                .param("customerId", customerId)
                .query((rs, rowNum) -> new CustomerHistoricalPointView(
                        rs.getObject("id", UUID.class),
                        rs.getString("point_type"),
                        rs.getBigDecimal("latitude"),
                        rs.getBigDecimal("longitude"),
                        rs.getBigDecimal("accuracy_meters"),
                        rs.getTimestamp("captured_at").toInstant(),
                        rs.getString("ref_text")
                )).list();
    }

    @Override
    public RoutePlanTemplateView createTemplate(NewTemplate template, List<NewTemplateStop> stops) {
        UUID templateId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO route_plan_template (
                    id, route_id, name, description, start_latitude, start_longitude,
                    start_address_reference, version, status, created_by, created_at, updated_at
                ) VALUES (
                    :id, :routeId, :name, :description, :startLat, :startLon,
                    :startRef, 1, 'ACTIVE', :createdBy, now(), now()
                )
                """)
                .param("id", templateId)
                .param("routeId", template.routeId())
                .param("name", template.name())
                .param("description", template.description() != null ? template.description() : "")
                .param("startLat", template.startLatitude())
                .param("startLon", template.startLongitude())
                .param("startRef", template.startAddressReference() != null ? template.startAddressReference() : "Bodega Central")
                .param("createdBy", template.createdBy())
                .update();

        insertTemplateStops(templateId, stops);
        return findTemplateById(templateId).orElseThrow();
    }

    @Override
    public RoutePlanTemplateView updateTemplate(UUID templateId, NewTemplate template, List<NewTemplateStop> stops) {
        jdbc.sql("""
                UPDATE route_plan_template
                SET name = :name, description = :description,
                    start_latitude = :startLat, start_longitude = :startLon,
                    start_address_reference = :startRef,
                    version = version + 1, updated_at = now()
                WHERE id = :id
                """)
                .param("id", templateId)
                .param("name", template.name())
                .param("description", template.description() != null ? template.description() : "")
                .param("startLat", template.startLatitude())
                .param("startLon", template.startLongitude())
                .param("startRef", template.startAddressReference())
                .update();

        jdbc.sql("DELETE FROM route_plan_template_stop WHERE template_id = :templateId")
                .param("templateId", templateId)
                .update();

        insertTemplateStops(templateId, stops);
        return findTemplateById(templateId).orElseThrow();
    }

    private void insertTemplateStops(UUID templateId, List<NewTemplateStop> stops) {
        for (var stop : stops) {
            jdbc.sql("""
                    INSERT INTO route_plan_template_stop (
                        id, template_id, customer_id, stop_order, instructions
                    ) VALUES (
                        gen_random_uuid(), :templateId, :customerId, :stopOrder, :instructions
                    )
                    """)
                    .param("templateId", templateId)
                    .param("customerId", stop.customerId())
                    .param("stopOrder", stop.stopOrder())
                    .param("instructions", stop.instructions() != null ? stop.instructions() : "")
                    .update();
        }
    }

    @Override
    public List<RoutePlanTemplateView> findTemplatesByRouteId(UUID routeId) {
        var templateIds = jdbc.sql("""
                SELECT id FROM route_plan_template
                WHERE route_id = :routeId AND status = 'ACTIVE'
                ORDER BY updated_at DESC
                """)
                .param("routeId", routeId)
                .query((rs, rowNum) -> rs.getObject("id", UUID.class))
                .list();

        return templateIds.stream().map(id -> findTemplateById(id).orElse(null))
                .filter(java.util.Objects::nonNull).toList();
    }

    @Override
    public Optional<RoutePlanTemplateView> findTemplateById(UUID templateId) {
        var header = jdbc.sql("""
                SELECT t.id, t.route_id, r.code AS route_code, r.name AS route_name,
                       t.name, t.description, t.start_latitude, t.start_longitude,
                       t.start_address_reference, t.version, t.status, t.created_at
                FROM route_plan_template t
                JOIN route r ON r.id = t.route_id
                WHERE t.id = :id
                """)
                .param("id", templateId)
                .query((rs, rowNum) -> new Object() {
                    final UUID id = rs.getObject("id", UUID.class);
                    final UUID routeId = rs.getObject("route_id", UUID.class);
                    final String routeCode = rs.getString("route_code");
                    final String routeName = rs.getString("route_name");
                    final String name = rs.getString("name");
                    final String desc = rs.getString("description");
                    final BigDecimal startLat = rs.getBigDecimal("start_latitude");
                    final BigDecimal startLon = rs.getBigDecimal("start_longitude");
                    final String startRef = rs.getString("start_address_reference");
                    final int version = rs.getInt("version");
                    final String status = rs.getString("status");
                    final Instant createdAt = rs.getTimestamp("created_at").toInstant();
                }).optional();

        if (header.isEmpty()) return Optional.empty();
        var h = header.get();

        var stops = jdbc.sql("""
                SELECT s.id, s.customer_id, c.code AS customer_code, c.name AS customer_name,
                       c.address_reference, s.stop_order, s.instructions,
                       COALESCE(loc.latitude, 0) AS target_latitude,
                       COALESCE(loc.longitude, 0) AS target_longitude
                FROM route_plan_template_stop s
                JOIN customer c ON c.id = s.customer_id
                LEFT JOIN customer_confirmed_location loc ON loc.customer_id = c.id AND loc.status = 'ACTIVE'
                WHERE s.template_id = :templateId
                ORDER BY s.stop_order ASC
                """)
                .param("templateId", templateId)
                .query((rs, rowNum) -> new RoutePlanTemplateStopView(
                        rs.getObject("id", UUID.class),
                        rs.getObject("customer_id", UUID.class),
                        rs.getString("customer_code"),
                        rs.getString("customer_name"),
                        rs.getString("address_reference"),
                        rs.getBigDecimal("target_latitude"),
                        rs.getBigDecimal("target_longitude"),
                        rs.getInt("stop_order"),
                        rs.getString("instructions")
                )).list();

        return Optional.of(new RoutePlanTemplateView(
                h.id, h.routeId, h.routeCode, h.routeName, h.name, h.desc,
                h.startLat, h.startLon, h.startRef, h.version, h.status, h.createdAt, stops
        ));
    }

    @Override
    public DailyItineraryRunView publishDailyItinerary(NewItineraryRun run, List<NewItineraryStop> stops) {
        UUID runId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO daily_itinerary_run (
                    id, route_id, route_load_id, template_id, operational_date,
                    seller_id, vehicle_id, start_latitude, start_longitude,
                    start_address_reference, published_polyline, status,
                    total_planned_stops, attended_stops, postponed_stops, version,
                    published_by, published_at
                ) VALUES (
                    :id, :routeId, CAST(:loadId AS uuid), CAST(:templateId AS uuid), :opDate,
                    :sellerId, CAST(:vehicleId AS uuid), :startLat, :startLon,
                    :startRef, CAST(:polyline AS text), 'PUBLISHED',
                    :totalStops, 0, 0, 1,
                    :publishedBy, now()
                )
                """)
                .param("id", runId)
                .param("routeId", run.routeId())
                .param("loadId", run.routeLoadId())
                .param("templateId", run.templateId())
                .param("opDate", java.sql.Date.valueOf(run.operationalDate()))
                .param("sellerId", run.sellerId())
                .param("vehicleId", run.vehicleId())
                .param("startLat", run.startLatitude())
                .param("startLon", run.startLongitude())
                .param("startRef", run.startAddressReference() != null ? run.startAddressReference() : "Bodega Central")
                .param("polyline", run.publishedPolyline())
                .param("totalStops", stops.size())
                .param("publishedBy", run.publishedBy())
                .update();

        for (var stop : stops) {
            jdbc.sql("""
                    INSERT INTO daily_itinerary_stop (
                        id, itinerary_run_id, customer_id, planned_order,
                        customer_name_snapshot, address_reference_snapshot,
                        target_latitude, target_longitude, accuracy_meters,
                        status
                    ) VALUES (
                        gen_random_uuid(), :runId, :customerId, :plannedOrder,
                        :nameSnapshot, :addrSnapshot,
                        :targetLat, :targetLon, CAST(:accuracy AS numeric),
                        'PENDING'
                    )
                    """)
                    .param("runId", runId)
                    .param("customerId", stop.customerId())
                    .param("plannedOrder", stop.plannedOrder())
                    .param("nameSnapshot", stop.customerNameSnapshot())
                    .param("addrSnapshot", stop.addressReferenceSnapshot())
                    .param("targetLat", stop.targetLatitude())
                    .param("targetLon", stop.targetLongitude())
                    .param("accuracy", stop.accuracyMeters())
                    .update();
        }

        return findItineraryById(runId).orElseThrow();
    }

    @Override
    public Optional<DailyItineraryRunView> findActiveItineraryByRouteId(UUID routeId) {
        var id = jdbc.sql("""
                SELECT id FROM daily_itinerary_run
                WHERE route_id = :routeId AND status IN ('PUBLISHED', 'IN_PROGRESS')
                ORDER BY published_at DESC LIMIT 1
                """)
                .param("routeId", routeId)
                .query((rs, rowNum) -> rs.getObject("id", UUID.class))
                .optional();

        return id.flatMap(this::findItineraryById);
    }

    @Override
    public Optional<DailyItineraryRunView> findActiveItineraryBySellerId(UUID sellerId) {
        var id = jdbc.sql("""
                SELECT id FROM daily_itinerary_run
                WHERE seller_id = :sellerId AND status IN ('PUBLISHED', 'IN_PROGRESS')
                ORDER BY published_at DESC LIMIT 1
                """)
                .param("sellerId", sellerId)
                .query((rs, rowNum) -> rs.getObject("id", UUID.class))
                .optional();

        return id.flatMap(this::findItineraryById);
    }

    @Override
    public Optional<DailyItineraryRunView> findItineraryByRouteLoadId(UUID routeLoadId) {
        var id = jdbc.sql("""
                SELECT id FROM daily_itinerary_run
                WHERE route_load_id = :loadId
                ORDER BY published_at DESC LIMIT 1
                """)
                .param("loadId", routeLoadId)
                .query((rs, rowNum) -> rs.getObject("id", UUID.class))
                .optional();

        return id.flatMap(this::findItineraryById);
    }

    @Override
    public DailyItineraryRunView updatePublishedDailyItinerary(UUID runId, NewItineraryRun run, List<NewItineraryStop> stops) {
        jdbc.sql("""
                UPDATE daily_itinerary_run
                SET template_id = CAST(:templateId AS uuid),
                    start_latitude = :startLat,
                    start_longitude = :startLon,
                    start_address_reference = :startRef,
                    total_planned_stops = :totalStops,
                    published_by = :publishedBy,
                    published_at = now()
                WHERE id = :id AND status = 'PUBLISHED'
                """)
                .param("id", runId)
                .param("templateId", run.templateId())
                .param("startLat", run.startLatitude())
                .param("startLon", run.startLongitude())
                .param("startRef", run.startAddressReference() != null ? run.startAddressReference() : "Bodega Central")
                .param("totalStops", stops.size())
                .param("publishedBy", run.publishedBy())
                .update();

        jdbc.sql("DELETE FROM daily_itinerary_stop WHERE itinerary_run_id = :runId AND status = 'PENDING'")
                .param("runId", runId)
                .update();

        for (var stop : stops) {
            jdbc.sql("""
                    INSERT INTO daily_itinerary_stop (
                        id, itinerary_run_id, customer_id, planned_order,
                        customer_name_snapshot, address_reference_snapshot,
                        target_latitude, target_longitude, accuracy_meters,
                        status
                    ) VALUES (
                        gen_random_uuid(), :runId, :customerId, :plannedOrder,
                        :nameSnapshot, :addrSnapshot,
                        :targetLat, :targetLon, CAST(:accuracy AS numeric),
                        'PENDING'
                    )
                    """)
                    .param("runId", runId)
                    .param("customerId", stop.customerId())
                    .param("plannedOrder", stop.plannedOrder())
                    .param("nameSnapshot", stop.customerNameSnapshot())
                    .param("addrSnapshot", stop.addressReferenceSnapshot())
                    .param("targetLat", stop.targetLatitude())
                    .param("targetLon", stop.targetLongitude())
                    .param("accuracy", stop.accuracyMeters())
                    .update();
        }

        return findItineraryById(runId).orElseThrow();
    }

    @Override
    public Optional<DailyItineraryRunView> findItineraryById(UUID itineraryId) {
        var header = jdbc.sql("""
                SELECT i.id, i.route_id, r.code AS route_code, r.name AS route_name,
                       i.route_load_id, rl.load_number, i.template_id, i.operational_date,
                       i.seller_id, s.display_name AS seller_name, i.vehicle_id, v.license_plate,
                       i.start_latitude, i.start_longitude, i.start_address_reference,
                       i.published_polyline, i.status, i.total_planned_stops,
                       i.attended_stops, i.postponed_stops, i.published_at,
                       i.closed_at, i.closure_reason
                FROM daily_itinerary_run i
                JOIN route r ON r.id = i.route_id
                JOIN route_load rl ON rl.id = i.route_load_id
                JOIN seller s ON s.id = i.seller_id
                LEFT JOIN vehicle v ON v.id = i.vehicle_id
                WHERE i.id = :id
                """)
                .param("id", itineraryId)
                .query((rs, rowNum) -> new Object() {
                    final UUID id = rs.getObject("id", UUID.class);
                    final UUID routeId = rs.getObject("route_id", UUID.class);
                    final String routeCode = rs.getString("route_code");
                    final String routeName = rs.getString("route_name");
                    final UUID loadId = rs.getObject("route_load_id", UUID.class);
                    final Long loadNumber = rs.getLong("load_number");
                    final UUID templateId = rs.getObject("template_id", UUID.class);
                    final LocalDate opDate = rs.getDate("operational_date").toLocalDate();
                    final UUID sellerId = rs.getObject("seller_id", UUID.class);
                    final String sellerName = rs.getString("seller_name");
                    final UUID vehicleId = rs.getObject("vehicle_id", UUID.class);
                    final String licensePlate = rs.getString("license_plate");
                    final BigDecimal startLat = rs.getBigDecimal("start_latitude");
                    final BigDecimal startLon = rs.getBigDecimal("start_longitude");
                    final String startRef = rs.getString("start_address_reference");
                    final String polyline = rs.getString("published_polyline");
                    final String status = rs.getString("status");
                    final int totalStops = rs.getInt("total_planned_stops");
                    final int attendedStops = rs.getInt("attended_stops");
                    final int postponedStops = rs.getInt("postponed_stops");
                    final Instant publishedAt = rs.getTimestamp("published_at").toInstant();
                    final Instant closedAt = rs.getTimestamp("closed_at") != null ? rs.getTimestamp("closed_at").toInstant() : null;
                    final String closureReason = rs.getString("closure_reason");
                }).optional();

        if (header.isEmpty()) return Optional.empty();
        var h = header.get();

        var stops = jdbc.sql("""
                SELECT id, itinerary_run_id, customer_id, planned_order,
                       customer_name_snapshot, address_reference_snapshot,
                       target_latitude, target_longitude, accuracy_meters,
                       status, execution_order, completed_at, sale_id,
                       no_purchase_reason, postponed_reason, notes,
                       observed_latitude, observed_longitude,
                       distance_deviation_meters, has_location_mismatch,
                       evidence_photo, evidence_photo_captured_at
                FROM daily_itinerary_stop
                WHERE itinerary_run_id = :id
                ORDER BY planned_order ASC
                """)
                .param("id", itineraryId)
                .query((rs, rowNum) -> new DailyItineraryStopView(
                        rs.getObject("id", UUID.class),
                        rs.getObject("itinerary_run_id", UUID.class),
                        rs.getObject("customer_id", UUID.class),
                        rs.getInt("planned_order"),
                        rs.getString("customer_name_snapshot"),
                        rs.getString("address_reference_snapshot"),
                        rs.getBigDecimal("target_latitude"),
                        rs.getBigDecimal("target_longitude"),
                        rs.getBigDecimal("accuracy_meters"),
                        rs.getString("status"),
                        (Integer) rs.getObject("execution_order"),
                        rs.getTimestamp("completed_at") != null ? rs.getTimestamp("completed_at").toInstant() : null,
                        rs.getObject("sale_id", UUID.class),
                        rs.getString("no_purchase_reason"),
                        rs.getString("postponed_reason"),
                        rs.getString("notes"),
                        rs.getBigDecimal("observed_latitude"),
                        rs.getBigDecimal("observed_longitude"),
                        rs.getBigDecimal("distance_deviation_meters"),
                        rs.getBoolean("has_location_mismatch"),
                        rs.getString("evidence_photo"),
                        rs.getTimestamp("evidence_photo_captured_at") != null ? rs.getTimestamp("evidence_photo_captured_at").toInstant() : null
                )).list();

        return Optional.of(new DailyItineraryRunView(
                h.id, h.routeId, h.routeCode, h.routeName, h.loadId, h.loadNumber,
                h.templateId, h.opDate, h.sellerId, h.sellerName, h.vehicleId, h.licensePlate,
                h.startLat, h.startLon, h.startRef, h.polyline, h.status,
                h.totalStops, h.attendedStops, h.postponedStops, h.publishedAt,
                h.closedAt, h.closureReason, stops
        ));
    }

    @Override
    public void recordStopSale(UUID itineraryRunId, UUID customerId, UUID saleId,
                               BigDecimal obsLat, BigDecimal obsLon, BigDecimal obsAcc,
                               BigDecimal distDev, boolean mismatch) {
        jdbc.sql("""
                UPDATE daily_itinerary_stop
                SET status = 'ATTENDED_SALE',
                    sale_id = CAST(:saleId AS uuid),
                    completed_at = now(),
                    observed_latitude = CAST(:obsLat AS numeric),
                    observed_longitude = CAST(:obsLon AS numeric),
                    observed_accuracy_meters = CAST(:obsAcc AS numeric),
                    distance_deviation_meters = CAST(:distDev AS numeric),
                    has_location_mismatch = :mismatch
                WHERE itinerary_run_id = :runId AND customer_id = :customerId
                """)
                .param("saleId", saleId)
                .param("obsLat", obsLat)
                .param("obsLon", obsLon)
                .param("obsAcc", obsAcc)
                .param("distDev", distDev)
                .param("mismatch", mismatch)
                .param("runId", itineraryRunId)
                .param("customerId", customerId)
                .update();

        if (obsLat != null && obsLon != null) {
            jdbc.sql("""
                    INSERT INTO customer_confirmed_location (
                        customer_id, latitude, longitude, accuracy_meters,
                        source_type, source_reference_id, confirmed_by, confirmed_at, notes, status
                    )
                    SELECT :customerId, CAST(:obsLat AS numeric), CAST(:obsLon AS numeric), CAST(:obsAcc AS numeric),
                           'SALE', CAST(:saleId AS uuid),
                           (SELECT s.user_id FROM daily_itinerary_run dir JOIN seller s ON s.id = dir.seller_id WHERE dir.id = :runId),
                           now(), 'Auto-confirmado por venta en ruta', 'ACTIVE'
                    WHERE NOT EXISTS (
                        SELECT 1 FROM customer_confirmed_location
                        WHERE customer_id = :customerId AND status = 'ACTIVE'
                    )
                    """)
                    .param("customerId", customerId)
                    .param("obsLat", obsLat)
                    .param("obsLon", obsLon)
                    .param("obsAcc", obsAcc)
                    .param("saleId", saleId)
                    .param("runId", itineraryRunId)
                    .update();
        }

        updateRunCounters(itineraryRunId);
    }

    @Override
    public void recordStopNoPurchaseVisit(UUID itineraryRunId, UUID customerId, String reason, String notes,
                                          BigDecimal obsLat, BigDecimal obsLon, BigDecimal obsAcc) {
        jdbc.sql("""
                UPDATE daily_itinerary_stop
                SET status = 'ATTENDED_NO_PURCHASE',
                    no_purchase_reason = :reason,
                    notes = :notes,
                    completed_at = now(),
                    observed_latitude = CAST(:obsLat AS numeric),
                    observed_longitude = CAST(:obsLon AS numeric),
                    observed_accuracy_meters = CAST(:obsAcc AS numeric)
                WHERE itinerary_run_id = :runId AND customer_id = :customerId
                """)
                .param("reason", reason)
                .param("notes", notes != null ? notes : "")
                .param("obsLat", obsLat)
                .param("obsLon", obsLon)
                .param("obsAcc", obsAcc)
                .param("runId", itineraryRunId)
                .param("customerId", customerId)
                .update();

        updateRunCounters(itineraryRunId);
    }

    @Override
    public void recordStopPostponed(UUID stopId, String reason, String notes,
                                    BigDecimal obsLat, BigDecimal obsLon, BigDecimal obsAcc,
                                    String evidencePhoto) {
        var runId = jdbc.sql("""
                UPDATE daily_itinerary_stop
                SET status = 'POSTPONED_BLOCKED',
                    postponed_reason = :reason,
                    notes = :notes,
                    observed_latitude = CAST(:obsLat AS numeric),
                    observed_longitude = CAST(:obsLon AS numeric),
                    observed_accuracy_meters = CAST(:obsAcc AS numeric),
                    evidence_photo = :evidencePhoto,
                    evidence_photo_captured_at = CASE WHEN :evidencePhoto IS NOT NULL THEN now() ELSE NULL END
                WHERE id = :stopId
                RETURNING itinerary_run_id
                """)
                .param("reason", reason)
                .param("notes", notes != null ? notes : "")
                .param("obsLat", obsLat)
                .param("obsLon", obsLon)
                .param("obsAcc", obsAcc)
                .param("evidencePhoto", evidencePhoto)
                .param("stopId", stopId)
                .query((rs, rowNum) -> rs.getObject("itinerary_run_id", UUID.class))
                .single();

        updateRunCounters(runId);
    }

    @Override
    public void closeItineraryIncomplete(UUID itineraryId, String reason, UUID closedBy) {
        jdbc.sql("""
                UPDATE daily_itinerary_run
                SET status = 'CLOSED_INCOMPLETE',
                    closure_reason = :reason,
                    closed_by = :closedBy,
                    closed_at = now()
                WHERE id = :id
                """)
                .param("reason", reason)
                .param("closedBy", closedBy)
                .param("id", itineraryId)
                .update();

        jdbc.sql("""
                UPDATE daily_itinerary_stop
                SET status = 'CANCELLED'
                WHERE itinerary_run_id = :id AND status IN ('PENDING', 'POSTPONED_BLOCKED')
                """)
                .param("id", itineraryId)
                .update();
    }

    @Override
    public void closeItineraryOnSettlement(UUID routeLoadId) {
        jdbc.sql("""
                UPDATE daily_itinerary_run
                SET status = CASE
                        WHEN attended_stops >= total_planned_stops THEN 'COMPLETED'
                        ELSE 'CLOSED_INCOMPLETE'
                    END,
                    closed_at = COALESCE(closed_at, now()),
                    closure_reason = COALESCE(closure_reason, 'Cierre automático por liquidación de ruta')
                WHERE route_load_id = :loadId AND status IN ('PUBLISHED', 'IN_PROGRESS')
                """)
                .param("loadId", routeLoadId)
                .update();
    }

    private void updateRunCounters(UUID itineraryRunId) {
        jdbc.sql("""
                UPDATE daily_itinerary_run
                SET status = CASE
                        WHEN status = 'PUBLISHED' THEN 'IN_PROGRESS'
                        WHEN (SELECT count(1) FROM daily_itinerary_stop WHERE itinerary_run_id = :runId AND status IN ('PENDING', 'POSTPONED_BLOCKED')) = 0 THEN 'COMPLETED'
                        ELSE status
                    END,
                    attended_stops = (
                        SELECT count(1) FROM daily_itinerary_stop
                        WHERE itinerary_run_id = :runId AND status IN ('ATTENDED_SALE', 'ATTENDED_NO_PURCHASE')
                    ),
                    postponed_stops = (
                        SELECT count(1) FROM daily_itinerary_stop
                        WHERE itinerary_run_id = :runId AND status = 'POSTPONED_BLOCKED'
                    )
                WHERE id = :runId
                """)
                .param("runId", itineraryRunId)
                .update();
    }

    private ConfirmedLocationView mapConfirmedLocation(ResultSet rs) throws SQLException {
        return new ConfirmedLocationView(
                rs.getObject("id", UUID.class),
                rs.getObject("customer_id", UUID.class),
                rs.getBigDecimal("latitude"),
                rs.getBigDecimal("longitude"),
                rs.getBigDecimal("accuracy_meters"),
                rs.getString("source_type"),
                rs.getObject("source_reference_id", UUID.class),
                rs.getObject("confirmed_by", UUID.class),
                rs.getTimestamp("confirmed_at").toInstant(),
                rs.getString("notes"),
                rs.getString("status")
        );
    }

    @Override
    public List<SalesOrderedCustomerView> findRouteCustomersOrderedBySales(UUID routeId) {
        return jdbc.sql("""
                SELECT c.id AS customer_id, c.code, c.name, c.address_reference,
                       MIN(s.created_at) AS first_sale_at,
                       COUNT(s.id) AS sales_count,
                       loc.latitude, loc.longitude, loc.accuracy_meters
                FROM customer c
                JOIN customer_route cr ON cr.customer_id = c.id
                     AND cr.route_id = :routeId
                     AND (cr.valid_to IS NULL OR cr.valid_to >= CURRENT_DATE)
                LEFT JOIN sale s ON s.customer_id = c.id AND s.status != 'ANNULLED'
                LEFT JOIN customer_confirmed_location loc ON loc.customer_id = c.id AND loc.status = 'ACTIVE'
                WHERE c.status = 'ACTIVE'
                GROUP BY c.id, c.code, c.name, c.address_reference, loc.latitude, loc.longitude, loc.accuracy_meters
                ORDER BY MIN(s.created_at) ASC NULLS LAST, c.code ASC
                """)
                .param("routeId", routeId)
                .query((rs, rowNum) -> new SalesOrderedCustomerView(
                        rs.getObject("customer_id", UUID.class),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getString("address_reference"),
                        rs.getBigDecimal("latitude"),
                        rs.getBigDecimal("longitude"),
                        rs.getBigDecimal("accuracy_meters"),
                        rs.getTimestamp("first_sale_at") != null ? rs.getTimestamp("first_sale_at").toInstant() : null,
                        rs.getLong("sales_count")
                )).list();
    }
}

