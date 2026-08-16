package gt.com.aguapura.application.dto.loading;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CreateRouteLoadRequest(
        @NotNull UUID routeId,
        @NotNull UUID sourceLocationId,
        @NotNull LocalDate plannedDate,
        String loadType,
        @Size(max = 500) String notes,
        @NotEmpty @Size(max = 100) List<@Valid ItemRequest> items
) {
    public record ItemRequest(
            @NotNull UUID productId,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 14, fraction = 4)
            BigDecimal quantityBaseUnits
    ) {
    }
}
