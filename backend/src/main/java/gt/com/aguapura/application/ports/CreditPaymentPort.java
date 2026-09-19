package gt.com.aguapura.application.ports;

import gt.com.aguapura.application.dto.credit.CreditBalanceResponse;
import gt.com.aguapura.application.dto.credit.CreditDecisionRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentResponse;
import gt.com.aguapura.application.dto.credit.CreditRoutePendingResponse;
import gt.com.aguapura.application.dto.credit.CreditStatementResponse;

import java.util.List;
import java.util.UUID;

public interface CreditPaymentPort {
    CreditPaymentResponse recordPayment(CreditPaymentRequest request, UUID actorId, UUID deviceId);
    CreditPaymentResponse decidePayment(UUID paymentId, CreditDecisionRequest request, UUID deciderId);
    CreditPaymentResponse findById(UUID paymentId);
    CreditPaymentVoucherPdfPort.VoucherData loadVoucherData(UUID paymentId);
    CreditStatementResponse getCustomerStatement(UUID customerId);
    CreditBalanceResponse getCustomerBalance(UUID customerId);
    CreditRoutePendingResponse getRoutePending(UUID routeId);
    List<CreditPaymentResponse> findPendingTransfers();
}
