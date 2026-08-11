package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.authorization.AuthorizationDecisionRequest;
import gt.com.aguapura.application.dto.authorization.AuthorizationResponse;
import gt.com.aguapura.application.dto.authorization.CreateAuthorizationRequest;
import gt.com.aguapura.application.dto.authorization.CreateIncidentRequest;
import gt.com.aguapura.application.dto.authorization.IncidentActionRequest;
import gt.com.aguapura.application.dto.authorization.IncidentResponse;
import gt.com.aguapura.application.services.AuthorizationIncidentApplicationService;
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
@RequestMapping("/api/operations-control")
public class AuthorizationIncidentController {
    private final AuthorizationIncidentApplicationService service;

    public AuthorizationIncidentController(AuthorizationIncidentApplicationService service) { this.service = service; }

    @GetMapping("/authorizations")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<AuthorizationResponse> authorizations(@AuthenticationPrincipal Jwt jwt) {
        return service.findAuthorizations(actor(jwt), sellerOnly(jwt));
    }
    @PostMapping("/authorizations")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public AuthorizationResponse request(@Valid @RequestBody CreateAuthorizationRequest request,
                                         @AuthenticationPrincipal Jwt jwt) {
        return service.request(request, actor(jwt), device(jwt), sellerOnly(jwt));
    }
    @PostMapping("/authorizations/{id}/decision")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public AuthorizationResponse decide(@PathVariable UUID id,
                                        @Valid @RequestBody AuthorizationDecisionRequest request,
                                        @AuthenticationPrincipal Jwt jwt) {
        return service.decide(id, request, actor(jwt), device(jwt));
    }
    @GetMapping("/incidents")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<IncidentResponse> incidents(@AuthenticationPrincipal Jwt jwt) {
        return service.findIncidents(actor(jwt), sellerOnly(jwt));
    }
    @PostMapping("/incidents")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public IncidentResponse report(@Valid @RequestBody CreateIncidentRequest request,
                                   @AuthenticationPrincipal Jwt jwt) {
        return service.reportIncident(request, actor(jwt), device(jwt), sellerOnly(jwt));
    }
    @PostMapping("/incidents/{id}/actions")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public IncidentResponse act(@PathVariable UUID id, @Valid @RequestBody IncidentActionRequest request,
                                @AuthenticationPrincipal Jwt jwt) {
        return service.actOnIncident(id, request, actor(jwt), device(jwt));
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }
    private boolean sellerOnly(Jwt jwt) {
        var roles=jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
    }
}
