package gt.com.aguapura.application.dto.itinerary;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record SaveConfirmedLocationRequest(
        @NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
        @DecimalMin("0") BigDecimal accuracyMeters,
        @Size(max = 40) String sourceType,
        UUID sourceReferenceId,
        @Size(max = 300) String notes
) {}
