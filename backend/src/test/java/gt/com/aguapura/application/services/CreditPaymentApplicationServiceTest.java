package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.credit.CreditBalanceResponse;
import gt.com.aguapura.application.dto.credit.CreditDecisionRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentResponse;
import gt.com.aguapura.application.dto.credit.CreditRoutePendingResponse;
import gt.com.aguapura.application.dto.credit.CreditStatementResponse;
import gt.com.aguapura.application.ports.CreditPaymentPort;
import gt.com.aguapura.application.ports.CreditPaymentVoucherPdfPort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CreditPaymentApplicationServiceTest {

    @Test
    void recordPaymentDelegatesToPort() {
        var port = mock(CreditPaymentPort.class);
        var voucherPdf = mock(CreditPaymentVoucherPdfPort.class);
        var service = new CreditPaymentApplicationService(port, voucherPdf);

        var customerId = UUID.randomUUID();
        var actorId = UUID.randomUUID();
        var deviceId = UUID.randomUUID();
        var request = new CreditPaymentRequest(customerId, null, new BigDecimal("150.00"), "CASH", "", "", "Abono");

        var expectedResponse = new CreditPaymentResponse(
                UUID.randomUUID(), customerId, "Farmacia Central", "CLI-001", null,
                new BigDecimal("150.00"), "CASH", "CONFIRMED", "", "", "", "Abono",
                actorId, "vendedor1", deviceId, null, null, null, Instant.now()
        );

        when(port.recordPayment(request, actorId, deviceId)).thenReturn(expectedResponse);

        var result = service.recordPayment(request, actorId, deviceId);

        assertThat(result.amount()).isEqualTo(new BigDecimal("150.00"));
        assertThat(result.status()).isEqualTo("CONFIRMED");
        verify(port).recordPayment(request, actorId, deviceId);
    }

    @Test
    void decidePaymentDelegatesToPort() {
        var port = mock(CreditPaymentPort.class);
        var voucherPdf = mock(CreditPaymentVoucherPdfPort.class);
        var service = new CreditPaymentApplicationService(port, voucherPdf);

        var paymentId = UUID.randomUUID();
        var deciderId = UUID.randomUUID();
        var request = new CreditDecisionRequest("APPROVE", "");

        var expectedResponse = new CreditPaymentResponse(
                paymentId, UUID.randomUUID(), "Farmacia Central", "CLI-001", null,
                new BigDecimal("200.00"), "TRANSFER", "VERIFIED", "REF-123", "BANRURAL", "", "",
                UUID.randomUUID(), "vendedor1", UUID.randomUUID(), deciderId, "admin_credito", Instant.now(), Instant.now()
        );

        when(port.decidePayment(paymentId, request, deciderId)).thenReturn(expectedResponse);

        var result = service.decidePayment(paymentId, request, deciderId);

        assertThat(result.status()).isEqualTo("VERIFIED");
        assertThat(result.verifiedByName()).isEqualTo("admin_credito");
        verify(port).decidePayment(paymentId, request, deciderId);
    }

    @Test
    void generateVoucherPdfLoadsDataAndCallsPdfGenerator() {
        var port = mock(CreditPaymentPort.class);
        var voucherPdf = mock(CreditPaymentVoucherPdfPort.class);
        var service = new CreditPaymentApplicationService(port, voucherPdf);

        var paymentId = UUID.randomUUID();
        var voucherData = new CreditPaymentVoucherPdfPort.VoucherData(
                "AB-12345678", Instant.now(), "Agua Pura S.A.", "Agua Pura S.A.", "123456-7",
                "Ciudad", "12345678", "12345678", null, null, "GTQ", "Cliente 1", "CLI-01",
                new BigDecimal("100.00"), "Efectivo", "", "", "vendedor1", "CONFIRMED", "Nota"
        );
        byte[] expectedPdf = "%PDF-1.4 mock".getBytes();

        when(port.loadVoucherData(paymentId)).thenReturn(voucherData);
        when(voucherPdf.generate(voucherData)).thenReturn(expectedPdf);

        var result = service.generateVoucherPdf(paymentId);

        assertThat(result).isEqualTo(expectedPdf);
        verify(port).loadVoucherData(paymentId);
        verify(voucherPdf).generate(voucherData);
    }

    @Test
    void getCustomerStatementReturnsPortResult() {
        var port = mock(CreditPaymentPort.class);
        var voucherPdf = mock(CreditPaymentVoucherPdfPort.class);
        var service = new CreditPaymentApplicationService(port, voucherPdf);
        var customerId = UUID.randomUUID();

        var expected = new CreditStatementResponse(
                customerId, "Cliente 1", "CLI-01", true, new BigDecimal("1000.00"),
                new BigDecimal("250.00"), new BigDecimal("750.00"), List.of()
        );
        when(port.getCustomerStatement(customerId)).thenReturn(expected);

        var result = service.getCustomerStatement(customerId);

        assertThat(result.currentBalance()).isEqualTo(new BigDecimal("250.00"));
        assertThat(result.availableCredit()).isEqualTo(new BigDecimal("750.00"));
        verify(port).getCustomerStatement(customerId);
    }

    @Test
    void getCustomerBalanceReturnsPortResult() {
        var port = mock(CreditPaymentPort.class);
        var voucherPdf = mock(CreditPaymentVoucherPdfPort.class);
        var service = new CreditPaymentApplicationService(port, voucherPdf);
        var customerId = UUID.randomUUID();

        var expected = new CreditBalanceResponse(
                customerId, "Cliente 1", "CLI-01", true, new BigDecimal("500.00"),
                new BigDecimal("100.00"), new BigDecimal("400.00")
        );
        when(port.getCustomerBalance(customerId)).thenReturn(expected);

        var result = service.getCustomerBalance(customerId);

        assertThat(result.availableCredit()).isEqualTo(new BigDecimal("400.00"));
        verify(port).getCustomerBalance(customerId);
    }

    @Test
    void getRoutePendingReturnsPortResult() {
        var port = mock(CreditPaymentPort.class);
        var voucherPdf = mock(CreditPaymentVoucherPdfPort.class);
        var service = new CreditPaymentApplicationService(port, voucherPdf);
        var routeId = UUID.randomUUID();

        var expected = new CreditRoutePendingResponse(routeId, "Ruta Sur", 1, new BigDecimal("200.00"), List.of());
        when(port.getRoutePending(routeId)).thenReturn(expected);

        var result = service.getRoutePending(routeId);

        assertThat(result.totalDebtors()).isEqualTo(1);
        assertThat(result.totalDebt()).isEqualTo(new BigDecimal("200.00"));
        verify(port).getRoutePending(routeId);
    }
}
