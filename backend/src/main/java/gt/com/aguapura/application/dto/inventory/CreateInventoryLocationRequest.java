package gt.com.aguapura.application.dto.inventory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateInventoryLocationRequest(
        @NotBlank @Size(max = 40) String code,
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Size(max = 20) String locationType,
        UUID routeId
) {
}
