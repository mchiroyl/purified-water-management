package gt.com.aguapura.application.dto.itinerary;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateRoutePlanTemplateRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 500) String description,
        @NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal startLatitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal startLongitude,
        @Size(max = 250) String startAddressReference,
        @NotEmpty List<@Valid StopItemRequest> stops
) {
    public record StopItemRequest(
            @NotNull UUID customerId,
            @Min(1) int stopOrder,
            @Size(max = 300) String instructions
    ) {}
}
