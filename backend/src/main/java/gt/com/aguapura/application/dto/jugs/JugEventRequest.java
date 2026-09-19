package gt.com.aguapura.application.dto.jugs;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.UUID;

public record JugEventRequest(
        @NotNull UUID customerId,
        @NotNull UUID routeId,
        UUID routeLoadId,
        UUID saleId,
        @NotBlank String eventType,
        @NotNull @Positive Integer quantity,
        BigDecimal unitPrice,
        String notes
) {
}
