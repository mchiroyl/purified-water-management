package gt.com.aguapura.application.dto.authorization;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public record CreateAuthorizationRequest(
        @NotBlank @Pattern(regexp = "LOAD_CORRECTION|SETTLEMENT_DIFFERENCE|CREDIT_LIMIT_CHANGE|OTHER_OPERATION") String authorizationType,
        @NotBlank @Pattern(regexp = "ROUTE_LOAD|SETTLEMENT|CUSTOMER|SALE") String entityType,
        @NotNull UUID entityId, @NotBlank @Size(max = 500) String reason,
        @NotNull @Future Instant expiresAt) {
}
