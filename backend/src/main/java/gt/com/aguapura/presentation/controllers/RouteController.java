package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.route.*;
import gt.com.aguapura.application.services.CustomerRouteApplicationService;
import gt.com.aguapura.application.services.AuditApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/routes")
public class RouteController {
    private final CustomerRouteApplicationService service;
    private final AuditApplicationService audit;
    public RouteController(CustomerRouteApplicationService service, AuditApplicationService audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<RouteResponse> findAll(@AuthenticationPrincipal Jwt jwt) {
        return service.findRoutes(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RouteResponse create(@Valid @RequestBody CreateRouteRequest request, @AuthenticationPrincipal Jwt jwt) {
        var result = service.createRoute(request);
        audit.record(actor(jwt), device(jwt), "CREATE_ROUTE", "ROUTE", result.id(), Map.of(),
                Map.of("code", result.code(), "name", result.name(), "status", result.status()));
        return result;
    }

    @PostMapping("/{id}/assignment")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RouteResponse assign(@PathVariable UUID id, @Valid @RequestBody AssignRouteRequest request,
                                @AuthenticationPrincipal Jwt jwt) {
        var result = service.assignRoute(id, request, actor(jwt));
        audit.record(actor(jwt), device(jwt), "ASSIGN_ROUTE", "ROUTE", id, Map.of(),
                Map.of("sellerId", request.sellerId(), "vehicleId", String.valueOf(request.vehicleId()),
                        "validFrom", request.validFrom().toString()));
        return result;
    }

    @GetMapping("/vehicles")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA')")
    public List<VehicleResponse> findVehicles() { return service.findVehicles(); }

    @PostMapping("/vehicles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public VehicleResponse createVehicle(@Valid @RequestBody CreateVehicleRequest request,
                                         @AuthenticationPrincipal Jwt jwt) {
        var result = service.createVehicle(request);
        audit.record(actor(jwt), device(jwt), "CREATE_VEHICLE", "VEHICLE", result.id(), Map.of(),
                Map.of("code", result.code(), "status", result.status()));
        return result;
    }

    @GetMapping("/sellers")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA')")
    public List<SellerOptionResponse> findSellers() { return service.findSellers(); }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }
    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
    }
}
