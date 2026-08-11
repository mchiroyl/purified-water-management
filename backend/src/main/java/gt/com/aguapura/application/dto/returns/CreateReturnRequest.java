package gt.com.aguapura.application.dto.returns;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CreateReturnRequest(
        @NotNull UUID clientReference,
        @NotBlank @Pattern(regexp = "UNSOLD_GOOD|CUSTOMER_RETURN") String returnType,
        @NotNull UUID routeId,
        UUID customerId,
        UUID saleId,
        @NotBlank @Size(max = 500) String reason,
        @NotNull Instant reportedAtLocal,
        @NotEmpty @Size(max = 100) @Valid List<Item> items) {
    public record Item(@NotNull UUID presentationId,
                       @NotNull @DecimalMin(value = "0.0001") BigDecimal presentationQuantity) {
    }
}
