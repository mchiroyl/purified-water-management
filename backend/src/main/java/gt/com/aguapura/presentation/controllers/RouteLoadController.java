package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.loading.CreateRouteLoadCorrectionRequest;
import gt.com.aguapura.application.dto.loading.CreateRouteLoadRequest;
import gt.com.aguapura.application.dto.loading.ConfirmRouteLoadReceiptRequest;
import gt.com.aguapura.application.dto.loading.RouteLoadResponse;
import gt.com.aguapura.application.services.RouteLoadApplicationService;
import gt.com.aguapura.application.services.AuditApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/loads")
public class RouteLoadController {
    private final RouteLoadApplicationService service;
    private final AuditApplicationService audit;

    public RouteLoadController(RouteLoadApplicationService service, AuditApplicationService audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<RouteLoadResponse> findAll(@AuthenticationPrincipal Jwt jwt) {
        return service.findLoads(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public RouteLoadResponse create(@Valid @RequestBody CreateRouteLoadRequest request,
                                    @AuthenticationPrincipal Jwt jwt) {
        var result = service.create(request, actor(jwt));
        audit.record(actor(jwt), device(jwt), "CREATE_ROUTE_LOAD", "ROUTE_LOAD", result.id(), Map.of(),
                Map.of("loadNumber", result.loadNumber(), "routeId", result.routeId(), "status", result.status()));
        return result;
    }

    @PostMapping("/{id}/warehouse-confirmation")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public RouteLoadResponse confirmWarehouse(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var result = service.confirmWarehouse(id, actor(jwt), device(jwt));
        audit.record(actor(jwt), device(jwt), "CONFIRM_ROUTE_LOAD", "ROUTE_LOAD", id,
                Map.of("status", "PREPARED"), Map.of("status", result.status(), "confirmation", "WAREHOUSE"));
        return result;
    }

    @PostMapping("/{id}/receipt")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public RouteLoadResponse confirmReceipt(@PathVariable UUID id,
                                            @Valid @RequestBody ConfirmRouteLoadReceiptRequest request,
                                            @AuthenticationPrincipal Jwt jwt) {
        var result = service.confirmReceipt(id, request, actor(jwt), device(jwt), sellerOnly(jwt));
        audit.record(actor(jwt), device(jwt), "CONFIRM_ROUTE_LOAD", "ROUTE_LOAD", id,
                Map.of("status", "WAREHOUSE_CONFIRMED"), Map.of("status", result.status(), "confirmation", "SELLER"));
        return result;
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public RouteLoadResponse start(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var result = service.start(id, actor(jwt), device(jwt), sellerOnly(jwt));
        audit.record(actor(jwt), device(jwt), "START_ROUTE_LOAD", "ROUTE_LOAD", id,
                Map.of("status", "RECEIVED"), Map.of("status", result.status()));
        return result;
    }

    @PostMapping("/{id}/corrections")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public RouteLoadResponse correct(@PathVariable UUID id,
                                     @Valid @RequestBody CreateRouteLoadCorrectionRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        var result = service.correct(id, request, actor(jwt), device(jwt));
        audit.record(actor(jwt), device(jwt), "CORRECT_ROUTE_LOAD", "ROUTE_LOAD", id, Map.of(),
                Map.of("status", result.status(), "correctionCount", result.corrections().size()));
        return result;
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getClaimAsString("userId"));
    }

    private UUID device(Jwt jwt) {
        return UUID.fromString(jwt.getClaimAsString("deviceId"));
    }

    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
    }
}
