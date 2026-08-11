package gt.com.aguapura.application.dto.sync;

import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record SyncOperationResult(
        UUID clientOperationId,
        String status,
        UUID serverEntityId,
        JsonNode result,
        String errorCode,
        String message,
        Instant processedAtServer
) {
}
