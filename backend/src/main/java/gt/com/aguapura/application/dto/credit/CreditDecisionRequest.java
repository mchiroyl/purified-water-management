package gt.com.aguapura.application.dto.credit;

import jakarta.validation.constraints.NotBlank;

public record CreditDecisionRequest(
        @NotBlank String decision,
        String rejectionReason
) {
}
