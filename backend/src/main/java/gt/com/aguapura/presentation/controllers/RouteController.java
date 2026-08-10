package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.route.*;
import gt.com.aguapura.application.services.CustomerRouteApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/routes")
public class RouteController {
    private final CustomerRouteApplicationService service;
    public RouteController(CustomerRouteApplicationService service) { this.service = service; }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<RouteResponse> findAll(@AuthenticationPrincipal Jwt jwt) {
        return service.findRoutes(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RouteResponse create(@Valid @RequestBody CreateRouteRequest request) { return service.createRoute(request); }

    @PostMapping("/{id}/assignment")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RouteResponse assign(@PathVariable UUID id, @Valid @RequestBody AssignRouteRequest request,
                                @AuthenticationPrincipal Jwt jwt) {
        return service.assignRoute(id, request, actor(jwt));
    }

    @GetMapping("/vehicles")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA')")
    public List<VehicleResponse> findVehicles() { return service.findVehicles(); }

    @PostMapping("/vehicles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public VehicleResponse createVehicle(@Valid @RequestBody CreateVehicleRequest request) {
        return service.createVehicle(request);
    }

    @GetMapping("/sellers")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA')")
    public List<SellerOptionResponse> findSellers() { return service.findSellers(); }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
    }
}
