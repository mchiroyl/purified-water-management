package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.settlement.CalculateSettlementRequest;
import gt.com.aguapura.application.dto.settlement.CashDeliveryRequest;
import gt.com.aguapura.application.dto.settlement.CloseSettlementRequest;
import gt.com.aguapura.application.dto.settlement.SettlementResponse;
import gt.com.aguapura.application.services.SettlementApplicationService;
import gt.com.aguapura.application.services.AuditApplicationService;
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
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/settlements")
public class SettlementController {
    private final SettlementApplicationService service;
    private final AuditApplicationService audit;

    public SettlementController(SettlementApplicationService service, AuditApplicationService audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<SettlementResponse> findAll(@AuthenticationPrincipal Jwt jwt) {
        return service.findAll(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping("/{loadId}/calculate")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public SettlementResponse calculate(@PathVariable UUID loadId,
                                        @Valid @RequestBody CalculateSettlementRequest request,
                                        @AuthenticationPrincipal Jwt jwt) {
        return service.calculate(loadId, request.pendingLocalOperations(), actor(jwt), sellerOnly(jwt));
    }

    @PostMapping("/{loadId}/cash-deliveries")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public SettlementResponse addCashDelivery(@PathVariable UUID loadId,
                                              @Valid @RequestBody CashDeliveryRequest request,
                                              @AuthenticationPrincipal Jwt jwt) {
        return service.addCashDelivery(loadId, request, actor(jwt), device(jwt));
    }

    @PostMapping("/{loadId}/close")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public SettlementResponse close(@PathVariable UUID loadId,
                                    @Valid @RequestBody CloseSettlementRequest request,
                                    @AuthenticationPrincipal Jwt jwt) {
        var result = service.close(loadId, request.pendingLocalOperations(), request.notes(), actor(jwt), device(jwt),
                role(jwt));
        audit.record(actor(jwt), device(jwt), "SETTLEMENT_CLOSE", "SETTLEMENT", result.id(), Map.of(),
                Map.of("routeLoadId", result.routeLoadId(), "status", result.status(),
                        "monetaryDifference", result.monetaryDifference(),
                        "physicalDifference", result.physicalDifferenceTotal()));
        return result;
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }
    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
    }
    private String role(Jwt jwt) {
        return jwt.getClaimAsStringList("roles").contains("ADMINISTRADOR") ? "ADMINISTRADOR" : "SUPERVISOR";
    }
}
