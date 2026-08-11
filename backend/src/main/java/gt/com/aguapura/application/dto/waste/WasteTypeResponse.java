package gt.com.aguapura.application.dto.waste;

import java.math.BigDecimal;
import java.util.UUID;

public record WasteTypeResponse(UUID id, String code, String name, String evidencePolicy,
                                BigDecimal warehouseApprovalLimitBaseUnits,
                                BigDecimal supervisorApprovalLimitBaseUnits,
                                int dailyAlertThreshold, boolean active) {
}
