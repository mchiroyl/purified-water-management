package gt.com.aguapura.application.ports;

import tools.jackson.databind.JsonNode;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;

import java.util.UUID;

public interface SyncOperationHandler {
    boolean supports(String entityType, String operationType);

    HandlerResult handle(SyncOperationRequest request, SyncActor actor);

    record SyncActor(UUID userId, UUID deviceId, boolean restrictedToSeller) {
    }

    record HandlerResult(UUID serverEntityId, JsonNode result) {
    }
}
