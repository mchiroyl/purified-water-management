package gt.com.aguapura.application.dto.route;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateRouteRequest(@NotBlank @Size(min = 2, max = 150) String name, @Size(max = 1000) String description) {}
