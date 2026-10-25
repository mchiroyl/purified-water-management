package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.sync.RoutePackageResponse;
import gt.com.aguapura.application.dto.sync.SyncBatchRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationResult;
import gt.com.aguapura.application.services.RoutePackageApplicationService;
import gt.com.aguapura.application.services.SyncBatchApplicationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sync")
public class SyncController {
    private final SyncBatchApplicationService service;
    private final RoutePackageApplicationService routePackageService;

    public SyncController(SyncBatchApplicationService service,
                          RoutePackageApplicationService routePackageService) {
        this.service = service;
        this.routePackageService = routePackageService;
    }

    @GetMapping("/route-package/{routeId}")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public RoutePackageResponse getRoutePackage(@PathVariable UUID routeId,
                                                @AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getSubject() != null ? jwt.getSubject() : jwt.getClaimAsString("username");
        return routePackageService.buildPackage(
                routeId,
                UUID.fromString(jwt.getClaimAsString("userId")),
                username != null ? username : "vendedor",
                jwt.getClaimAsStringList("roles"),
                UUID.fromString(jwt.getClaimAsString("deviceId"))
        );
    }

    @PostMapping("/batch")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public List<SyncOperationResult> batch(@Valid @RequestBody SyncBatchRequest request,
                                           @AuthenticationPrincipal Jwt jwt) {
        return service.process(request, UUID.fromString(jwt.getClaimAsString("userId")),
                UUID.fromString(jwt.getClaimAsString("deviceId")), sellerOnly(jwt));
    }

    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR"));
    }
}
