package gt.com.aguapura.application.dto.settlement;

import jakarta.validation.constraints.Min;

public record CalculateSettlementRequest(@Min(0) int pendingLocalOperations) {
}
