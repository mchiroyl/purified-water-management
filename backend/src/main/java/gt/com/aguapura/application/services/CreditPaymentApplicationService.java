package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.credit.CreditBalanceResponse;
import gt.com.aguapura.application.dto.credit.CreditDecisionRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentResponse;
import gt.com.aguapura.application.dto.credit.CreditRoutePendingResponse;
import gt.com.aguapura.application.dto.credit.CreditStatementResponse;
import gt.com.aguapura.application.ports.CreditPaymentPort;
import gt.com.aguapura.application.ports.CreditPaymentVoucherPdfPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CreditPaymentApplicationService {
    private final CreditPaymentPort port;
    private final CreditPaymentVoucherPdfPort voucherPdf;

    public CreditPaymentApplicationService(CreditPaymentPort port, CreditPaymentVoucherPdfPort voucherPdf) {
        this.port = port;
        this.voucherPdf = voucherPdf;
    }

    @Transactional
    public CreditPaymentResponse recordPayment(CreditPaymentRequest request, UUID actorId, UUID deviceId) {
        return port.recordPayment(request, actorId, deviceId);
    }

    @Transactional
    public CreditPaymentResponse decidePayment(UUID paymentId, CreditDecisionRequest request, UUID deciderId) {
        return port.decidePayment(paymentId, request, deciderId);
    }

    public CreditPaymentResponse findById(UUID paymentId) {
        return port.findById(paymentId);
    }

    public byte[] generateVoucherPdf(UUID paymentId) {
        var voucherData = port.loadVoucherData(paymentId);
        return voucherPdf.generate(voucherData);
    }

    public CreditStatementResponse getCustomerStatement(UUID customerId) {
        return port.getCustomerStatement(customerId);
    }

    public CreditBalanceResponse getCustomerBalance(UUID customerId) {
        return port.getCustomerBalance(customerId);
    }

    public CreditRoutePendingResponse getRoutePending(UUID routeId) {
        return port.getRoutePending(routeId);
    }

    public List<CreditPaymentResponse> findPendingTransfers() {
        return port.findPendingTransfers();
    }
}
