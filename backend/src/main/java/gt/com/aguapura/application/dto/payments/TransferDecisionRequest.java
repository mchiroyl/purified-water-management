package gt.com.aguapura.application.dto.payments;

import jakarta.validation.constraints.Size;

public record TransferDecisionRequest(boolean approve, @Size(max = 500) String rejectionReason) {
}
