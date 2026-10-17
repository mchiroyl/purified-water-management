package gt.com.aguapura.application.dto.itinerary;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record PostponeStopRequest(
        @NotBlank @Size(max = 50) String reason,
        @Size(max = 500) String notes,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal accuracyMeters,
        String evidencePhoto
) {}

