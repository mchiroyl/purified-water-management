package gt.com.aguapura.application.dto.route;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateRouteRequest(
        @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9-]+") String code,
        @NotBlank @Size(min = 2, max = 150) String name,
        @Size(max = 1000) String description
) {}
