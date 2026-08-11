package gt.com.aguapura.application.dto.waste;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record WasteTypeRequest(
        @NotBlank @Size(max = 40) String code,
        @NotBlank @Size(max = 150) String name,
        @NotBlank @Pattern(regexp = "REQUIRED|RECOMMENDED|NONE") String evidencePolicy,
        @NotNull @DecimalMin("0") BigDecimal warehouseApprovalLimitBaseUnits,
        @NotNull @DecimalMin("0") BigDecimal supervisorApprovalLimitBaseUnits,
        @Min(1) int dailyAlertThreshold,
        boolean active) {
}
