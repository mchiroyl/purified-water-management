package gt.com.aguapura.application.dto.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record RegistrationDecisionRequest(
        @NotBlank @Pattern(regexp = "APPROVED|REJECTED|MERGED") String decision,
        UUID targetCustomerId,
        @Size(max = 1000) String reason
) {
}
