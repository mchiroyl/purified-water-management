package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.jugs.JugBalanceResponse;
import gt.com.aguapura.application.dto.jugs.JugEventRequest;
import gt.com.aguapura.application.dto.jugs.JugEventResponse;
import gt.com.aguapura.application.dto.jugs.JugHistoryResponse;
import gt.com.aguapura.application.dto.jugs.JugRouteSummaryResponse;
import gt.com.aguapura.application.services.AuditApplicationService;
import gt.com.aguapura.application.services.JugLoanApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/jugs")
public class JugLoanController {
    private final JugLoanApplicationService service;
    private final AuditApplicationService audit;

    public JugLoanController(JugLoanApplicationService service, AuditApplicationService audit) {
        this.service = service;
        this.audit = audit;
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('VENDEDOR', 'ADMINISTRADOR')")
    public JugEventResponse recordEvent(@Valid @RequestBody JugEventRequest request,
                                        @AuthenticationPrincipal Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getClaimAsString("userId"));
        UUID deviceId = UUID.fromString(jwt.getClaimAsString("deviceId"));
        var response = service.recordEvent(request, actorId, deviceId);
        audit.record(actorId, deviceId, "JUG_LOAN_EVENT", "JUG_LOAN_EVENT", response.id(),
                Map.of(), Map.of(
                        "eventType", response.eventType(),
                        "quantity", response.quantity(),
                        "customerId", response.customerId(),
                        "routeId", response.routeId()
                ));
        return response;
    }

    @GetMapping("/customers/{customerId}/balance")
    @PreAuthorize("hasAnyRole('VENDEDOR', 'ADMINISTRADOR_CREDITO', 'ADMINISTRADOR', 'SUPERVISOR')")
    public JugBalanceResponse getCustomerBalance(@PathVariable UUID customerId) {
        return service.getCustomerBalance(customerId);
    }

    @GetMapping("/customers/{customerId}/history")
    @PreAuthorize("hasAnyRole('VENDEDOR', 'ADMINISTRADOR_CREDITO', 'ADMINISTRADOR', 'SUPERVISOR')")
    public JugHistoryResponse getCustomerHistory(@PathVariable UUID customerId) {
        return service.getCustomerHistory(customerId);
    }

    @GetMapping("/routes/{routeId}/summary")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR_CREDITO', 'ADMINISTRADOR', 'SUPERVISOR')")
    public JugRouteSummaryResponse getRouteSummary(@PathVariable UUID routeId) {
        return service.getRouteSummary(routeId);
    }
}
