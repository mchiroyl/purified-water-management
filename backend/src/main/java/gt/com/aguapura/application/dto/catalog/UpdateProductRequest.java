package gt.com.aguapura.application.dto.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProductRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 500) String description,
        @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_-]+") String baseUnitCode,
        boolean controlsInventory
) { }
