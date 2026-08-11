package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.loading.CreateRouteLoadCorrectionRequest;
import gt.com.aguapura.application.dto.loading.CreateRouteLoadRequest;
import gt.com.aguapura.application.dto.loading.RouteLoadResponse;
import gt.com.aguapura.application.services.RouteLoadApplicationService;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/loads")
public class RouteLoadController {
    private final RouteLoadApplicationService service;

    public RouteLoadController(RouteLoadApplicationService service) {
        this.service = service;
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
        return service.create(request, actor(jwt));
    }

    @PostMapping("/{id}/warehouse-confirmation")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public RouteLoadResponse confirmWarehouse(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.confirmWarehouse(id, actor(jwt), device(jwt));
    }

    @PostMapping("/{id}/receipt")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public RouteLoadResponse confirmReceipt(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.confirmReceipt(id, actor(jwt), device(jwt), sellerOnly(jwt));
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public RouteLoadResponse start(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.start(id, actor(jwt), device(jwt), sellerOnly(jwt));
    }

    @PostMapping("/{id}/corrections")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public RouteLoadResponse correct(@PathVariable UUID id,
                                     @Valid @RequestBody CreateRouteLoadCorrectionRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        return service.correct(id, request, actor(jwt), device(jwt));
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
