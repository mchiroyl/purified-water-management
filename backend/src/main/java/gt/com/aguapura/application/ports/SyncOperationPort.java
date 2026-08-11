package gt.com.aguapura.application.ports;

import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SyncOperationPort {
    Optional<StoredOperation> find(UUID deviceId, UUID clientOperationId);

    boolean tryStart(NewOperation operation);

    boolean tryRestart(UUID deviceId, UUID clientOperationId, String payloadHash);

    boolean dependenciesCompleted(UUID deviceId, List<UUID> dependencies);

    void complete(UUID deviceId, UUID clientOperationId, CompletedOperation completed);

    record NewOperation(UUID id, UUID deviceId, UUID clientOperationId, UUID userId, String entityType,
                        String operationType, UUID aggregateLocalId, JsonNode payload, String payloadHash,
                        List<UUID> dependencies, java.time.Instant createdAtLocal) {
    }

    record StoredOperation(UUID deviceId, UUID clientOperationId, String payloadHash, String processingStatus,
                           String resultStatus, UUID serverEntityId, JsonNode result, String errorCode,
                           String errorMessage) {
    }

    record CompletedOperation(String resultStatus, UUID serverEntityId, JsonNode result, String errorCode,
                              String errorMessage) {
    }
}
