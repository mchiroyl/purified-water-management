package gt.com.aguapura.application.dto.sync;

import tools.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SyncOperationRequest(
        @NotNull UUID clientOperationId,
        @NotNull UUID deviceId,
        @NotBlank @Size(max = 40) @Pattern(regexp = "[A-Z_]+") String entityType,
        @NotBlank @Size(max = 40) @Pattern(regexp = "[A-Z_]+") String operationType,
        @NotNull UUID aggregateLocalId,
        @NotNull JsonNode payload,
        @NotNull @Size(max = 20) List<@NotNull UUID> dependencies,
        @NotNull Instant createdAtLocal
) {
    public SyncOperationRequest {
        dependencies = dependencies == null ? List.of() : List.copyOf(dependencies);
    }
}
