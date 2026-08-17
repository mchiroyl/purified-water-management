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
import java.util.UUID;

public record CreateProductRequest(
        @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9_-]+") String code,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 500) String description,
        @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_-]+") String baseUnitCode,
        boolean controlsInventory,
        @Size(max = 20) List<UUID> presentationIds,
        @Size(max = 20) List<@Valid PresentationRequest> presentations
) {
    public record PresentationRequest(
            @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9_-]+") String code,
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_-]+") String unitCode,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 13, fraction = 6)
            BigDecimal conversionFactor
    ) {
    }
}
