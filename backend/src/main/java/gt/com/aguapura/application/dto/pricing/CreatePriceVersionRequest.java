package gt.com.aguapura.application.dto.pricing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CreatePriceVersionRequest(@NotNull Instant validFrom, @NotEmpty @Size(max = 100) List<@Valid TierRequest> tiers) {
    public record TierRequest(
            @NotNull UUID presentationId,
            @NotNull @DecimalMin("0.0001") BigDecimal minimumBaseUnits,
            @DecimalMin("0.0001") BigDecimal maximumBaseUnits,
            @NotNull @DecimalMin("0.01") BigDecimal unitPrice
    ) {}
}
