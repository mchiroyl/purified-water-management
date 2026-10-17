package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.itinerary.*;
import gt.com.aguapura.application.services.ItineraryApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ItineraryController {

    private final ItineraryApplicationService service;

    public ItineraryController(ItineraryApplicationService service) {
        this.service = service;
    }

    // ── Ubicaciones confirmadas de clientes ──────────────────────────────────────
    @PostMapping("/customers/{customerId}/confirmed-location")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public ConfirmedLocationResponse saveConfirmedLocation(
            @PathVariable UUID customerId,
            @Valid @RequestBody SaveConfirmedLocationRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return service.saveConfirmedLocation(customerId, request, actor(jwt), device(jwt));
    }

    @GetMapping("/customers/{customerId}/confirmed-location")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public ResponseEntity<ConfirmedLocationResponse> findConfirmedLocation(@PathVariable UUID customerId) {
        return service.findConfirmedLocation(customerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/customers/{customerId}/historical-points")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public List<CustomerHistoricalPointResponse> findHistoricalPoints(@PathVariable UUID customerId) {
        return service.findHistoricalPoints(customerId);
    }

    @PostMapping("/routes/{routeId}/auto-confirm-locations")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public AutoConfirmSummary autoConfirmRouteLocations(@PathVariable UUID routeId, @AuthenticationPrincipal Jwt jwt) {
        return service.autoConfirmRouteLocations(routeId, actor(jwt), device(jwt));
    }

    @GetMapping("/routes/{routeId}/sales-ordered-customers")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public List<SalesOrderedCustomerResponse> findRouteCustomersOrderedBySales(@PathVariable UUID routeId) {
        return service.findRouteCustomersOrderedBySales(routeId);
    }

    // ── Plantillas de ruta ────────────────────────────────────────────────────────
    @PostMapping("/routes/{routeId}/templates")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RoutePlanTemplateResponse createTemplate(
            @PathVariable UUID routeId,
            @Valid @RequestBody CreateRoutePlanTemplateRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return service.createTemplate(routeId, request, actor(jwt), device(jwt));
    }

    @PutMapping("/routes/templates/{templateId}")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RoutePlanTemplateResponse updateTemplate(
            @PathVariable UUID templateId,
            @Valid @RequestBody CreateRoutePlanTemplateRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return service.updateTemplate(templateId, request, actor(jwt), device(jwt));
    }

    @GetMapping("/routes/{routeId}/templates")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public List<RoutePlanTemplateResponse> findTemplatesByRoute(@PathVariable UUID routeId) {
        return service.findTemplatesByRoute(routeId);
    }

    @GetMapping("/routes/templates/{templateId}")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public RoutePlanTemplateResponse findTemplateById(@PathVariable UUID templateId) {
        return service.findTemplateById(templateId);
    }

    // ── Itinerarios de jornada ────────────────────────────────────────────────────
    @PostMapping("/routes/{routeId}/itineraries/publish")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public DailyItineraryRunResponse publishDailyItinerary(
            @PathVariable UUID routeId,
            @Valid @RequestBody PublishDailyItineraryRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return service.publishDailyItinerary(routeId, request, actor(jwt), device(jwt));
    }

    @GetMapping("/routes/{routeId}/itineraries/active")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public ResponseEntity<DailyItineraryRunResponse> findActiveItineraryByRoute(@PathVariable UUID routeId) {
        return service.findActiveItineraryByRoute(routeId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/itineraries/active")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public ResponseEntity<DailyItineraryRunResponse> findActiveItinerary(
            @RequestParam(required = false) UUID routeId,
            @AuthenticationPrincipal Jwt jwt) {
        if (routeId != null) {
            return service.findActiveItineraryByRoute(routeId)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.noContent().build());
        }
        return service.findActiveItineraryForSeller(actor(jwt))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/itineraries/my-active")
    @PreAuthorize("hasRole('VENDEDOR')")
    public ResponseEntity<DailyItineraryRunResponse> findMyActiveItinerary(@AuthenticationPrincipal Jwt jwt) {
        return service.findActiveItineraryForSeller(actor(jwt))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/itineraries/{id}")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public DailyItineraryRunResponse findItineraryById(@PathVariable UUID id) {
        return service.findItineraryById(id);
    }

    @PostMapping("/itineraries/stops/{stopId}/postpone")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('VENDEDOR')")
    public void postponeStop(
            @PathVariable UUID stopId,
            @Valid @RequestBody PostponeStopRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        service.postponeStop(stopId, request, actor(jwt), device(jwt));
    }

    @PostMapping("/itineraries/{id}/close-incomplete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public void closeItineraryIncomplete(
            @PathVariable UUID id,
            @Valid @RequestBody CloseItineraryRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        service.closeItineraryIncomplete(id, request, actor(jwt), device(jwt));
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }
}
