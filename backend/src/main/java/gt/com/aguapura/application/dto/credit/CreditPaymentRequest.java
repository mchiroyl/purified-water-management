package gt.com.aguapura.application.dto.credit;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.UUID;

public record CreditPaymentRequest(
        @NotNull UUID customerId,
        UUID routeLoadId,
        @NotNull @Positive BigDecimal amount,
        @NotBlank String paymentMethod,
        String reference,
        String bank,
        String notes
) {
}
