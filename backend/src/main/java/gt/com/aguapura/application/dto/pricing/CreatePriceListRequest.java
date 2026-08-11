package gt.com.aguapura.application.dto.pricing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreatePriceListRequest(
        @NotBlank @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9-]+") String code,
        @NotBlank @Size(min = 2, max = 150) String name,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currencyCode
) {}
