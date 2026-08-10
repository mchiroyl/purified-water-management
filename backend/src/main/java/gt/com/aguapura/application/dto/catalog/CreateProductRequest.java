package gt.com.aguapura.application.dto.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record CreateProductRequest(
        @NotBlank @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9_-]+") String code,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 500) String description,
        @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_-]+") String baseUnitCode,
        boolean controlsInventory,
        @NotEmpty @Size(max = 20) List<@Valid PresentationRequest> presentations
) {
    public record PresentationRequest(
            @NotBlank @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9_-]+") String code,
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_-]+") String unitCode,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 13, fraction = 6)
            BigDecimal conversionFactor
    ) {
    }
}
