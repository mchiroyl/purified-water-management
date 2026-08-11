package gt.com.aguapura.application.dto.loading;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateRouteLoadCorrectionRequest(
        @NotNull UUID productId,
        @NotNull @Digits(integer = 14, fraction = 4) BigDecimal quantityDelta,
        @NotBlank @Size(max = 500) String reason
) {
}
