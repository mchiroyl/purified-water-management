package gt.com.aguapura.application.dto.sales;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateSaleRequest(
        @NotNull UUID clientReference,
        @NotNull UUID routeId,
        @NotNull UUID customerId,
        @NotEmpty @Size(max = 100) List<@Valid ItemRequest> items
) {
    public record ItemRequest(
            @NotNull UUID presentationId,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 14, fraction = 4)
            BigDecimal quantity
    ) {
    }
}
