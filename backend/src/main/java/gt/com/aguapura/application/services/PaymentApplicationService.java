package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.payments.TransferDecisionRequest;
import gt.com.aguapura.application.dto.payments.TransferPaymentResponse;
import gt.com.aguapura.application.ports.PaymentPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.payments.PaymentPolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PaymentApplicationService {
    private final PaymentPort persistence;

    public PaymentApplicationService(PaymentPort persistence) {
        this.persistence = persistence;
    }

    @Transactional(readOnly = true)
    public List<TransferPaymentResponse> findTransfers() {
        return persistence.findTransfers().stream().map(this::response).toList();
    }

    @Transactional
    public TransferPaymentResponse decide(UUID id, TransferDecisionRequest request, UUID actorId) {
        var current = persistence.findTransfer(id).orElseThrow(() -> new BusinessException(
                "TRANSFER_NOT_FOUND", "No se encontró la transferencia.", ErrorCategory.NOT_FOUND));
        String status = PaymentPolicy.transferDecision(current.status(), current.registeredBy(), actorId,
                request.approve(), request.rejectionReason());
        String reason = request.approve() ? "" : request.rejectionReason().trim();
        return response(persistence.decideTransfer(id, status, actorId, reason));
    }

    private TransferPaymentResponse response(PaymentPort.TransferView item) {
        return new TransferPaymentResponse(item.id(), item.saleId(), item.documentNumber(), item.routeId(),
                item.routeCode(), item.routeName(), item.sellerId(), item.sellerName(), item.customerId(),
                item.customerCode(), item.customerName(), item.amount(), item.currencyCode(), item.status(),
                item.reference(), item.bank(), item.evidenceReference(), item.registeredBy(),
                item.registeredByUsername(), item.deviceId(), item.verifiedBy(), item.verifiedByUsername(),
                item.verifiedAt(), item.rejectionReason(), item.createdAt());
    }
}
