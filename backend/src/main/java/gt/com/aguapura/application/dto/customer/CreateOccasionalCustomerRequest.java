package gt.com.aguapura.application.dto.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateOccasionalCustomerRequest(
        @NotNull UUID routeId,
        @NotBlank @Size(max = 180) String name,
        @Size(max = 30) String phone,
        @Size(max = 30) String whatsapp,
        @NotBlank @Size(max = 1000) String addressReference
) {
}
