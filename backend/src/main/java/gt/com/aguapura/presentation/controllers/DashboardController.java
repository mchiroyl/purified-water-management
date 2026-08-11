package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.dashboard.DashboardResponse;
import gt.com.aguapura.application.services.DashboardApplicationService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardApplicationService service;

    public DashboardController(DashboardApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public DashboardResponse get(@AuthenticationPrincipal Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        boolean sellerOnly = roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
        return service.get(UUID.fromString(jwt.getClaimAsString("userId")), sellerOnly);
    }
}
