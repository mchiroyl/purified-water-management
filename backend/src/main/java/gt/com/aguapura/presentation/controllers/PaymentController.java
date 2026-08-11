package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.payments.TransferDecisionRequest;
import gt.com.aguapura.application.dto.payments.TransferPaymentResponse;
import gt.com.aguapura.application.services.PaymentApplicationService;
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
@RequestMapping("/api/payments/transfers")
@PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
public class PaymentController {
    private final PaymentApplicationService service;

    public PaymentController(PaymentApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public List<TransferPaymentResponse> findAll() {
        return service.findTransfers();
    }

    @PostMapping("/{id}/decision")
    public TransferPaymentResponse decide(@PathVariable UUID id,
                                          @Valid @RequestBody TransferDecisionRequest request,
                                          @AuthenticationPrincipal Jwt jwt) {
        return service.decide(id, request, UUID.fromString(jwt.getClaimAsString("userId")));
    }
}
