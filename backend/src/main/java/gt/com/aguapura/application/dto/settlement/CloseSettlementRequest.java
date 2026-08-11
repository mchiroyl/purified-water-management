package gt.com.aguapura.application.dto.settlement;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CloseSettlementRequest(@Min(0) int pendingLocalOperations,
                                     @NotBlank @Size(max = 500) String notes) {
}
