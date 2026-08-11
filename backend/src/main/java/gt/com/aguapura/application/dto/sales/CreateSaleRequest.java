package gt.com.aguapura.application.dto.sales;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateSaleRequest(
        @NotNull UUID clientReference,
        @NotNull UUID routeId,
        @NotNull UUID customerId,
        @NotEmpty @Size(max = 100) List<@Valid ItemRequest> items,
        @NotEmpty @Size(max = 3) List<@Valid PaymentRequest> payments
) {
    public record ItemRequest(
            @NotNull UUID presentationId,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 14, fraction = 4)
            BigDecimal quantity
    ) {
    }

    public record PaymentRequest(
            @NotNull @Pattern(regexp = "CASH|TRANSFER|CREDIT") String method,
            @DecimalMin(value = "0", inclusive = false) @Digits(integer = 14, fraction = 2) BigDecimal amount,
            @Size(max = 120) String reference,
            @Size(max = 120) String bank,
            @Size(max = 500) String evidenceReference
    ) {
    }
}
