package gt.com.aguapura.application.dto.fel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record FelConfigurationRequest(
        boolean enabled,
        @Size(max = 100) String providerCode,
        @NotBlank @Pattern(regexp = "TEST|PRODUCTION") String environment,
        @Size(max = 40) String establishmentCode,
        @PositiveOrZero long version
) {
}
