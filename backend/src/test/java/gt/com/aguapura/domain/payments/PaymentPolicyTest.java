package gt.com.aguapura.domain.payments;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PaymentPolicyTest {
    @Test
    void assignsTheWholeTotalWhenThereIsOnePaymentWithoutAmount() {
        var result = PaymentPolicy.allocate(new BigDecimal("17.00"),
                List.of(new PaymentPolicy.Request("CASH", null, "", "", "")));

        assertThat(result).singleElement().satisfies(payment -> {
            assertThat(payment.amount()).isEqualByComparingTo("17.00");
            assertThat(payment.status()).isEqualTo("CONFIRMED");
        });
    }

    @Test
    void acceptsAnExactSplitAndLeavesTransferPending() {
        var result = PaymentPolicy.allocate(new BigDecimal("20.00"), List.of(
                new PaymentPolicy.Request("CASH", new BigDecimal("5.00"), "", "", ""),
                new PaymentPolicy.Request("TRANSFER", new BigDecimal("15.00"), "TRX-9", "Banco QA", "img-9")
        ));

        assertThat(result).extracting(PaymentPolicy.Allocation::status)
                .containsExactly("CONFIRMED", "PENDING_VERIFICATION");
    }

    @Test
    void rejectsPaymentTotalsThatDoNotMatchTheSale() {
        assertThatThrownBy(() -> PaymentPolicy.allocate(new BigDecimal("20.00"), List.of(
                new PaymentPolicy.Request("CASH", new BigDecimal("19.99"), "", "", "")
        ))).isInstanceOf(BusinessException.class)
                .hasMessageContaining("total");
    }

    @Test
    void rejectsTransferWithoutReference() {
        assertThatThrownBy(() -> PaymentPolicy.allocate(new BigDecimal("10.00"), List.of(
                new PaymentPolicy.Request("TRANSFER", null, "", "Banco QA", "")
        ))).isInstanceOf(BusinessException.class)
                .hasMessageContaining("referencia");
    }

    @Test
    void validatesPermanentCustomerCreditAndAvailableLimit() {
        PaymentPolicy.validateCredit("PERMANENT", true, new BigDecimal("100.00"),
                new BigDecimal("30.00"), new BigDecimal("70.00"));

        assertThatThrownBy(() -> PaymentPolicy.validateCredit("PERMANENT", true,
                new BigDecimal("100.00"), new BigDecimal("30.00"), new BigDecimal("70.01")))
                .isInstanceOf(BusinessException.class).hasMessageContaining("límite");
        assertThatThrownBy(() -> PaymentPolicy.validateCredit("PROVISIONAL", true,
                new BigDecimal("100.00"), BigDecimal.ZERO, BigDecimal.ONE))
                .isInstanceOf(BusinessException.class).hasMessageContaining("permanentes");
    }

    @Test
    void transferDecisionRequiresAnotherActorAndAReasonWhenRejected() {
        UUID registrar = UUID.randomUUID();
        UUID verifier = UUID.randomUUID();

        assertThat(PaymentPolicy.transferDecision("PENDING_VERIFICATION", registrar, verifier, true, ""))
                .isEqualTo("VERIFIED");
        assertThatThrownBy(() -> PaymentPolicy.transferDecision("PENDING_VERIFICATION", registrar, registrar,
                true, "")).isInstanceOf(BusinessException.class).hasMessageContaining("misma persona");
        assertThatThrownBy(() -> PaymentPolicy.transferDecision("PENDING_VERIFICATION", registrar, verifier,
                false, "")).isInstanceOf(BusinessException.class).hasMessageContaining("motivo");
    }
}
