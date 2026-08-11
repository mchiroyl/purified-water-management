package gt.com.aguapura.application.dto.authorization;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateIncidentRequest(UUID routeId, UUID settlementId,
                                    @Size(max = 40) String referenceType, UUID referenceId,
                                    @NotBlank @Pattern(regexp = "CASH_DIFFERENCE|PHYSICAL_DIFFERENCE|INVENTORY|ROUTE|CUSTOMER|DEVICE|OTHER") String incidentType,
                                    @NotBlank @Pattern(regexp = "LOW|MEDIUM|HIGH|CRITICAL") String severity,
                                    @NotBlank @Size(max = 1000) String description) {
}
