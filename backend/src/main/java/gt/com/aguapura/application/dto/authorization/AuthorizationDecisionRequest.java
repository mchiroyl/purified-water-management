package gt.com.aguapura.application.dto.authorization;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AuthorizationDecisionRequest(@NotBlank @Pattern(regexp = "APPROVE|REJECT") String decision,
                                           @NotBlank @Size(max = 500) String notes) {
}
