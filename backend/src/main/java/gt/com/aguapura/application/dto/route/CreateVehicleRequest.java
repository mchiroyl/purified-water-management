package gt.com.aguapura.application.dto.route;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateVehicleRequest(
        @NotBlank @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9-]+") String code,
        @Size(max = 20) String licensePlate,
        @Size(max = 200) String description
) {}
