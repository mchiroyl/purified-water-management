package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.itinerary.*;
import gt.com.aguapura.application.ports.CustomerRoutePort;
import gt.com.aguapura.application.ports.ItineraryPort;
import gt.com.aguapura.application.ports.RouteLoadPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
public class ItineraryApplicationService {

    private final ItineraryPort persistence;
    private final CustomerRoutePort customerRoutePort;
    private final RouteLoadPort routeLoadPort;
    private final AuditApplicationService audit;

    public ItineraryApplicationService(ItineraryPort persistence,
                                       CustomerRoutePort customerRoutePort,
                                       RouteLoadPort routeLoadPort,
                                       AuditApplicationService audit) {
        this.persistence = persistence;
        this.customerRoutePort = customerRoutePort;
        this.routeLoadPort = routeLoadPort;
        this.audit = audit;
    }

    // ── Ubicaciones confirmadas de cliente ────────────────────────────────────────
    @Transactional
    public ConfirmedLocationResponse saveConfirmedLocation(UUID customerId,
                                                           SaveConfirmedLocationRequest request,
                                                           UUID actorId,
                                                           UUID deviceId) {
        var view = new ItineraryPort.ConfirmedLocationView(
                UUID.randomUUID(), customerId, request.latitude(), request.longitude(),
                request.accuracyMeters(), request.sourceType(), request.sourceReferenceId(),
                actorId, null, request.notes(), "ACTIVE"
        );
        persistence.saveCustomerConfirmedLocation(view);

        audit.record(actorId, deviceId, "CONFIRM_CUSTOMER_LOCATION", "CUSTOMER",
                customerId, Map.of(), Map.of("lat", request.latitude(), "lon", request.longitude()));

        return findConfirmedLocation(customerId)
                .orElseThrow(() -> new BusinessException("LOCATION_NOT_SAVED", "No se pudo recuperar la ubicación confirmada.", ErrorCategory.INTERNAL));
    }

    @Transactional(readOnly = true)
    public Optional<ConfirmedLocationResponse> findConfirmedLocation(UUID customerId) {
        return persistence.findCustomerConfirmedLocation(customerId).map(this::mapConfirmedLocation);
    }

    @Transactional(readOnly = true)
    public List<CustomerHistoricalPointResponse> findHistoricalPoints(UUID customerId) {
        return persistence.findCustomerHistoricalPoints(customerId).stream()
                .map(p -> new CustomerHistoricalPointResponse(
                        p.id(), p.pointType(), p.latitude(), p.longitude(),
                        p.accuracyMeters(), p.capturedAt(), p.referenceText()
                )).toList();
    }

    @Transactional
    public AutoConfirmSummary autoConfirmRouteLocations(UUID routeId, UUID actorId, UUID deviceId) {
        var routeCustomers = customerRoutePort.findCustomers(Optional.empty()).stream()
                .filter(c -> routeId.equals(c.routeId()))
                .toList();
        int autoConfirmed = 0;
        int alreadyHadLocation = 0;
        int noHistoricalData = 0;

        for (var customer : routeCustomers) {
            if (persistence.findCustomerConfirmedLocation(customer.id()).isPresent()) {
                alreadyHadLocation++;
                continue;
            }
            var points = persistence.findCustomerHistoricalPoints(customer.id());
            if (!points.isEmpty()) {
                var bestPoint = points.get(0);
                var view = new ItineraryPort.ConfirmedLocationView(
                        UUID.randomUUID(), customer.id(), bestPoint.latitude(), bestPoint.longitude(),
                        bestPoint.accuracyMeters(), "AUTO_SALES_HISTORY", bestPoint.id(),
                        actorId, null, "Auto-confirmado desde historial de ventas", "ACTIVE"
                );
                persistence.saveCustomerConfirmedLocation(view);
                autoConfirmed++;
            } else {
                noHistoricalData++;
            }
        }

        audit.record(actorId, deviceId, "AUTO_CONFIRM_ROUTE_LOCATIONS", "ROUTE",
                routeId, Map.of(), Map.of("autoConfirmed", autoConfirmed, "alreadyHadLocation", alreadyHadLocation));

        return new AutoConfirmSummary(autoConfirmed, alreadyHadLocation, noHistoricalData);
    }

    @Transactional
    public Optional<DailyItineraryRunResponse> autoPublishIfTemplateExists(UUID routeLoadId, UUID routeId, UUID actorId, UUID deviceId) {
        if (persistence.findActiveItineraryByRouteId(routeId).isPresent()) {
            return Optional.empty();
        }
        var templates = persistence.findTemplatesByRouteId(routeId);
        if (templates.isEmpty()) {
            return Optional.empty();
        }
        var template = templates.get(0);
        var request = new PublishDailyItineraryRequest(routeLoadId, template.id());
        return Optional.of(publishDailyItinerary(routeId, request, actorId, deviceId));
    }

    @Transactional
    public void closeItineraryOnSettlement(UUID routeLoadId) {
        persistence.closeItineraryOnSettlement(routeLoadId);
    }

    // ── Plantillas de ruta ────────────────────────────────────────────────────────
    @Transactional
    public RoutePlanTemplateResponse createTemplate(UUID routeId,
                                                    CreateRoutePlanTemplateRequest request,
                                                    UUID actorId,
                                                    UUID deviceId) {
        validateStopOrders(request.stops());
        var newTemplate = new ItineraryPort.NewTemplate(
                routeId, request.name().trim(), request.description(),
                request.startLatitude(), request.startLongitude(),
                request.startAddressReference(), actorId
        );
        var stops = request.stops().stream()
                .map(s -> new ItineraryPort.NewTemplateStop(s.customerId(), s.stopOrder(), s.instructions()))
                .toList();

        var created = persistence.createTemplate(newTemplate, stops);
        audit.record(actorId, deviceId, "CREATE_ROUTE_TEMPLATE", "ROUTE_PLAN_TEMPLATE",
                created.id(), Map.of(), Map.of("name", created.name(), "stopsCount", stops.size()));
        return mapTemplate(created);
    }

    @Transactional
    public RoutePlanTemplateResponse updateTemplate(UUID templateId,
                                                    CreateRoutePlanTemplateRequest request,
                                                    UUID actorId,
                                                    UUID deviceId) {
        var existing = persistence.findTemplateById(templateId)
                .orElseThrow(() -> notFound("TEMPLATE_NOT_FOUND", "No se encontró la plantilla de ruta."));
        validateStopOrders(request.stops());

        var updateTemplate = new ItineraryPort.NewTemplate(
                existing.routeId(), request.name().trim(), request.description(),
                request.startLatitude(), request.startLongitude(),
                request.startAddressReference(), actorId
        );
        var stops = request.stops().stream()
                .map(s -> new ItineraryPort.NewTemplateStop(s.customerId(), s.stopOrder(), s.instructions()))
                .toList();

        var updated = persistence.updateTemplate(templateId, updateTemplate, stops);
        audit.record(actorId, deviceId, "UPDATE_ROUTE_TEMPLATE", "ROUTE_PLAN_TEMPLATE",
                templateId, Map.of(), Map.of("name", updated.name(), "stopsCount", stops.size()));
        return mapTemplate(updated);
    }

    @Transactional(readOnly = true)
    public List<RoutePlanTemplateResponse> findTemplatesByRoute(UUID routeId) {
        return persistence.findTemplatesByRouteId(routeId).stream().map(this::mapTemplate).toList();
    }

    @Transactional(readOnly = true)
    public RoutePlanTemplateResponse findTemplateById(UUID templateId) {
        return persistence.findTemplateById(templateId).map(this::mapTemplate)
                .orElseThrow(() -> notFound("TEMPLATE_NOT_FOUND", "No se encontró la plantilla de ruta."));
    }

    // ── Itinerarios de jornada ────────────────────────────────────────────────────
    @Transactional
    public DailyItineraryRunResponse publishDailyItinerary(UUID routeId,
                                                           PublishDailyItineraryRequest request,
                                                           UUID actorId,
                                                           UUID deviceId) {
        var load = routeLoadPort.findLoad(request.routeLoadId());
        if (!load.routeId().equals(routeId)) {
            throw validation("LOAD_ROUTE_MISMATCH", "La carga no pertenece a la ruta especificada.");
        }

        var activeTemplate = request.templateId() != null
                ? persistence.findTemplateById(request.templateId())
                : persistence.findTemplatesByRouteId(routeId).stream().findFirst();

        if (activeTemplate.isEmpty()) {
            throw validation("NO_TEMPLATE_AVAILABLE", "No hay una plantilla de ruta configurada para publicar el itinerario.");
        }
        var template = activeTemplate.get();

        var route = customerRoutePort.findRoutes(Optional.empty()).stream()
                .filter(r -> r.id().equals(routeId)).findFirst()
                .orElseThrow(() -> notFound("ROUTE_NOT_FOUND", "No se encontró la ruta."));

        if (route.sellerId() == null) {
            throw validation("ROUTE_NO_SELLER", "La ruta no tiene un vendedor asignado.");
        }

        var stops = new ArrayList<ItineraryPort.NewItineraryStop>();
        for (var stop : template.stops()) {
            var custOpt = customerRoutePort.findCustomers(Optional.empty()).stream()
                    .filter(c -> c.id().equals(stop.customerId())).findFirst();
            String custName = custOpt.map(CustomerRoutePort.CustomerView::name).orElse(stop.customerName());
            String addr = custOpt.map(CustomerRoutePort.CustomerView::addressReference).orElse(stop.addressReference());

            stops.add(new ItineraryPort.NewItineraryStop(
                    stop.customerId(), stop.stopOrder(), custName, addr,
                    stop.targetLatitude() != null ? stop.targetLatitude() : BigDecimal.ZERO,
                    stop.targetLongitude() != null ? stop.targetLongitude() : BigDecimal.ZERO,
                    BigDecimal.valueOf(15)
            ));
        }

        var newRun = new ItineraryPort.NewItineraryRun(
                routeId, load.id(), template.id(), LocalDate.now(),
                route.sellerId(), route.vehicleId(),
                template.startLatitude(), template.startLongitude(),
                template.startAddressReference(), null, actorId
        );

        var existingRunOpt = persistence.findItineraryByRouteLoadId(request.routeLoadId());
        ItineraryPort.DailyItineraryRunView published;
        if (existingRunOpt.isPresent()) {
            var existing = existingRunOpt.get();
            if (!"PUBLISHED".equals(existing.status())) {
                throw conflict("ITINERARY_ALREADY_IN_PROGRESS",
                        "El vendedor ya inició o completó el recorrido de esta carga, por lo que no puede modificarse.");
            }
            published = persistence.updatePublishedDailyItinerary(existing.id(), newRun, stops);
            audit.record(actorId, deviceId, "UPDATE_DAILY_ITINERARY", "DAILY_ITINERARY_RUN",
                    published.id(), Map.of(), Map.of("loadNumber", load.loadNumber(), "stopsCount", stops.size()));
        } else {
            published = persistence.publishDailyItinerary(newRun, stops);
            audit.record(actorId, deviceId, "PUBLISH_DAILY_ITINERARY", "DAILY_ITINERARY_RUN",
                    published.id(), Map.of(), Map.of("loadNumber", load.loadNumber(), "stopsCount", stops.size()));
        }

        return mapItinerary(published);
    }

    @Transactional(readOnly = true)
    public Optional<DailyItineraryRunResponse> findActiveItineraryByRoute(UUID routeId) {
        return persistence.findActiveItineraryByRouteId(routeId).map(this::mapItinerary);
    }

    @Transactional(readOnly = true)
    public Optional<DailyItineraryRunResponse> findActiveItineraryForSeller(UUID userId) {
        var sellerId = customerRoutePort.findSellerIdByUserId(userId);
        if (sellerId.isEmpty()) return Optional.empty();
        return persistence.findActiveItineraryBySellerId(sellerId.get()).map(this::mapItinerary);
    }

    @Transactional(readOnly = true)
    public DailyItineraryRunResponse findItineraryById(UUID itineraryId) {
        return persistence.findItineraryById(itineraryId).map(this::mapItinerary)
                .orElseThrow(() -> notFound("ITINERARY_NOT_FOUND", "No se encontró el itinerario."));
    }

    @Transactional
    public void postponeStop(UUID stopId, PostponeStopRequest request, UUID actorId, UUID deviceId) {
        persistence.recordStopPostponed(
                stopId,
                request.reason(),
                request.notes(),
                request.latitude(),
                request.longitude(),
                request.accuracyMeters(),
                request.evidencePhoto()
        );
        audit.record(actorId, deviceId, "POSTPONE_ITINERARY_STOP", "DAILY_ITINERARY_STOP",
                stopId, Map.of(), Map.of(
                        "reason", request.reason(),
                        "hasPhoto", request.evidencePhoto() != null && !request.evidencePhoto().isBlank()
                ));
    }

    @Transactional
    public void closeItineraryIncomplete(UUID itineraryId, CloseItineraryRequest request, UUID actorId, UUID deviceId) {
        persistence.closeItineraryIncomplete(itineraryId, request.reason(), actorId);
        audit.record(actorId, deviceId, "CLOSE_ITINERARY_INCOMPLETE", "DAILY_ITINERARY_RUN",
                itineraryId, Map.of(), Map.of("reason", request.reason()));
    }

    // ── Mappers & Helpers ────────────────────────────────────────────────────────
    private void validateStopOrders(List<CreateRoutePlanTemplateRequest.StopItemRequest> stops) {
        var seenOrders = new HashSet<Integer>();
        var seenCustomers = new HashSet<UUID>();
        for (var s : stops) {
            if (!seenOrders.add(s.stopOrder())) {
                throw validation("DUPLICATE_STOP_ORDER", "No puede haber dos paradas con el mismo orden: " + s.stopOrder());
            }
            if (!seenCustomers.add(s.customerId())) {
                throw validation("DUPLICATE_CUSTOMER_STOP", "Un cliente no puede repetirse en la misma plantilla.");
            }
        }
    }

    private ConfirmedLocationResponse mapConfirmedLocation(ItineraryPort.ConfirmedLocationView v) {
        return new ConfirmedLocationResponse(
                v.id(), v.customerId(), v.latitude(), v.longitude(),
                v.accuracyMeters(), v.sourceType(), v.sourceReferenceId(),
                v.confirmedBy(), v.confirmedAt(), v.notes(), v.status()
        );
    }

    private RoutePlanTemplateResponse mapTemplate(ItineraryPort.RoutePlanTemplateView v) {
        return new RoutePlanTemplateResponse(
                v.id(), v.routeId(), v.routeCode(), v.routeName(), v.name(), v.description(),
                v.startLatitude(), v.startLongitude(), v.startAddressReference(),
                v.version(), v.status(), v.createdAt(),
                v.stops().stream().map(s -> new RoutePlanTemplateResponse.StopResponse(
                        s.id(), s.customerId(), s.customerCode(), s.customerName(),
                        s.addressReference(), s.targetLatitude(), s.targetLongitude(),
                        s.stopOrder(), s.instructions()
                )).toList()
        );
    }

    private DailyItineraryRunResponse mapItinerary(ItineraryPort.DailyItineraryRunView v) {
        return new DailyItineraryRunResponse(
                v.id(), v.routeId(), v.routeCode(), v.routeName(),
                v.routeLoadId(), v.loadNumber(), v.templateId(), v.operationalDate(),
                v.sellerId(), v.sellerName(), v.vehicleId(), v.licensePlate(),
                v.startLatitude(), v.startLongitude(), v.startAddressReference(),
                v.publishedPolyline(), v.status(), v.totalPlannedStops(),
                v.attendedStops(), v.postponedStops(), v.publishedAt(),
                v.closedAt(), v.closureReason(),
                v.stops().stream().map(s -> new DailyItineraryRunResponse.StopResponse(
                        s.id(), s.itineraryRunId(), s.customerId(), s.plannedOrder(),
                        s.customerNameSnapshot(), s.addressReferenceSnapshot(),
                        s.targetLatitude(), s.targetLongitude(), s.accuracyMeters(),
                        s.status(), s.executionOrder(), s.completedAt(), s.saleId(),
                        s.noPurchaseReason(), s.postponedReason(), s.notes(),
                        s.observedLatitude(), s.observedLongitude(),
                        s.distanceDeviationMeters(), s.hasLocationMismatch(),
                        s.evidencePhoto(), s.evidencePhotoCapturedAt()
                )).toList()
        );
    }

    public List<SalesOrderedCustomerResponse> findRouteCustomersOrderedBySales(UUID routeId) {
        return persistence.findRouteCustomersOrderedBySales(routeId).stream()
                .map(v -> new SalesOrderedCustomerResponse(
                        v.customerId(), v.customerCode(), v.customerName(),
                        v.addressReference(), v.targetLatitude(), v.targetLongitude(),
                        v.accuracyMeters(), v.firstSaleAt(), v.salesCount()
                )).toList();
    }

    private BusinessException notFound(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.NOT_FOUND);
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.CONFLICT);
    }
}
