package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.payments.TransferDecisionRequest;
import gt.com.aguapura.application.dto.payments.TransferPaymentResponse;
import gt.com.aguapura.application.services.PaymentApplicationService;
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
@RequestMapping("/api/payments/transfers")
@PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
public class PaymentController {
    private final PaymentApplicationService service;
    private final AuditApplicationService audit;

    public PaymentController(PaymentApplicationService service, AuditApplicationService audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping
    public List<TransferPaymentResponse> findAll() {
        return service.findTransfers();
    }

    @PostMapping("/{id}/decision")
    public TransferPaymentResponse decide(@PathVariable UUID id,
                                          @Valid @RequestBody TransferDecisionRequest request,
                                          @AuthenticationPrincipal Jwt jwt) {
        var result = service.decide(id, request, UUID.fromString(jwt.getClaimAsString("userId")));
        audit.record(UUID.fromString(jwt.getClaimAsString("userId")),
                UUID.fromString(jwt.getClaimAsString("deviceId")), "TRANSFER_DECISION", "TRANSFER_PAYMENT", id,
                Map.of(), Map.of("status", result.status(), "saleId", result.saleId()));
        return result;
    }
}
