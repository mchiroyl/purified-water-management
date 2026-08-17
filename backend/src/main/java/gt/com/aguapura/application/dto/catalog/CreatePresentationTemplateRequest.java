package gt.com.aguapura.application.dto.catalog;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreatePresentationTemplateRequest(
        @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9_-]+") String code,
        @NotBlank @Size(max = 60) String presentationType,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 3)
        BigDecimal contentQuantity,
        @NotBlank @Size(max = 10) @Pattern(regexp = "[A-Za-z0-9_-]+") String contentUnit,
        @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_-]+") String unitCode,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 13, fraction = 6)
        BigDecimal conversionFactor
) { }
