package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.credit.CreditBalanceResponse;
import gt.com.aguapura.application.dto.credit.CreditDecisionRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentResponse;
import gt.com.aguapura.application.dto.credit.CreditRoutePendingResponse;
import gt.com.aguapura.application.dto.credit.CreditStatementResponse;
import gt.com.aguapura.application.services.AuditApplicationService;
import gt.com.aguapura.application.services.CreditPaymentApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/credit")
public class CreditPaymentController {
    private final CreditPaymentApplicationService service;
    private final AuditApplicationService audit;

    public CreditPaymentController(CreditPaymentApplicationService service, AuditApplicationService audit) {
        this.service = service;
        this.audit = audit;
    }

    @PostMapping("/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('VENDEDOR', 'ADMINISTRADOR_CREDITO', 'ADMINISTRADOR')")
    public CreditPaymentResponse recordPayment(@Valid @RequestBody CreditPaymentRequest request,
                                               @AuthenticationPrincipal Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getClaimAsString("userId"));
        UUID deviceId = UUID.fromString(jwt.getClaimAsString("deviceId"));
        var response = service.recordPayment(request, actorId, deviceId);
        audit.record(actorId, deviceId, "CREDIT_PAYMENT_REGISTERED", "CREDIT_PAYMENT", response.id(),
                Map.of(), Map.of(
                        "customerId", response.customerId(),
                        "amount", response.amount(),
                        "method", response.paymentMethod(),
                        "status", response.status()
                ));
        return response;
    }

    @PostMapping("/payments/{id}/decision")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR_CREDITO', 'ADMINISTRADOR')")
    public CreditPaymentResponse decidePayment(@PathVariable UUID id,
                                               @Valid @RequestBody CreditDecisionRequest request,
                                               @AuthenticationPrincipal Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getClaimAsString("userId"));
        UUID deviceId = UUID.fromString(jwt.getClaimAsString("deviceId"));
        var response = service.decidePayment(id, request, actorId);
        audit.record(actorId, deviceId, "CREDIT_PAYMENT_DECISION", "CREDIT_PAYMENT", response.id(),
                Map.of(), Map.of(
                        "decision", request.decision(),
                        "status", response.status(),
                        "amount", response.amount(),
                        "customerId", response.customerId()
                ));
        return response;
    }

    @GetMapping("/payments/{id}/voucher")
    @PreAuthorize("hasAnyRole('VENDEDOR', 'ADMINISTRADOR_CREDITO', 'ADMINISTRADOR')")
    public ResponseEntity<byte[]> getVoucherPdf(@PathVariable UUID id) {
        byte[] pdfBytes = service.generateVoucherPdf(id);
        String filename = "comprobante-abono-" + id + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @GetMapping("/payments/transfers/pending")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR_CREDITO', 'ADMINISTRADOR')")
    public List<CreditPaymentResponse> findPendingTransfers() {
        return service.findPendingTransfers();
    }

    @GetMapping("/customers/{customerId}/statement")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR_CREDITO', 'ADMINISTRADOR')")
    public CreditStatementResponse getCustomerStatement(@PathVariable UUID customerId) {
        return service.getCustomerStatement(customerId);
    }

    @GetMapping("/customers/{customerId}/balance")
    @PreAuthorize("hasAnyRole('VENDEDOR', 'ADMINISTRADOR_CREDITO', 'ADMINISTRADOR')")
    public CreditBalanceResponse getCustomerBalance(@PathVariable UUID customerId) {
        return service.getCustomerBalance(customerId);
    }

    @GetMapping("/routes/{routeId}/pending")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR_CREDITO', 'ADMINISTRADOR')")
    public CreditRoutePendingResponse getRoutePending(@PathVariable UUID routeId) {
        return service.getRoutePending(routeId);
    }
}
