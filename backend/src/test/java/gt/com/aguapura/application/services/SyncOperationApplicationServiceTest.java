package gt.com.aguapura.application.services;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import gt.com.aguapura.application.ports.SyncOperationPort;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SyncOperationApplicationServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void fiveReplaysProduceOneEffectAndReturnStoredResult() {
        var persistence = new InMemorySyncOperationPort();
        var handler = new CountingHandler(mapper);
        var service = new SyncOperationApplicationService(persistence, List.of(handler), mapper);
        UUID deviceId = UUID.randomUUID();
        UUID operationId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        var request = request(deviceId, operationId, mapper.createObjectNode().put("value", 42));

        var results = java.util.stream.IntStream.range(0, 5)
                .mapToObj(index -> service.process(request, actorId, deviceId, true))
                .toList();

        assertThat(handler.effects).isEqualTo(1);
        assertThat(persistence.operations).hasSize(1);
        assertThat(results.getFirst().status()).isEqualTo("ACCEPTED");
        assertThat(results.stream().skip(1)).allMatch(result -> result.status().equals("ALREADY_PROCESSED"));
        assertThat(results).extracting(result -> result.serverEntityId()).containsOnly(handler.serverEntityId);
        assertThat(results).extracting(result -> result.result().path("effect").asInt()).containsOnly(1);
    }

    @Test
    void rejectsReusingAnOperationIdWithDifferentPayload() {
        var persistence = new InMemorySyncOperationPort();
        var handler = new CountingHandler(mapper);
        var service = new SyncOperationApplicationService(persistence, List.of(handler), mapper);
        UUID deviceId = UUID.randomUUID();
        UUID operationId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        service.process(request(deviceId, operationId, mapper.createObjectNode().put("value", 1)), actorId, deviceId, true);

        var result = service.process(request(deviceId, operationId,
                mapper.createObjectNode().put("value", 2)), actorId, deviceId, true);

        assertThat(result.status()).isEqualTo("CONFLICT");
        assertThat(result.errorCode()).isEqualTo("IDEMPOTENCY_PAYLOAD_MISMATCH");
        assertThat(handler.effects).isEqualTo(1);
    }

    @Test
    void rejectsADeviceThatDoesNotMatchAuthenticatedToken() {
        var persistence = new InMemorySyncOperationPort();
        var handler = new CountingHandler(mapper);
        var service = new SyncOperationApplicationService(persistence, List.of(handler), mapper);

        var result = service.process(request(UUID.randomUUID(), UUID.randomUUID(), mapper.createObjectNode()),
                UUID.randomUUID(), UUID.randomUUID(), true);

        assertThat(result.status()).isEqualTo("REJECTED");
        assertThat(result.errorCode()).isEqualTo("SYNC_DEVICE_MISMATCH");
        assertThat(handler.effects).isZero();
        assertThat(persistence.operations).isEmpty();
    }

    private SyncOperationRequest request(UUID deviceId, UUID operationId, ObjectNode payload) {
        return new SyncOperationRequest(operationId, deviceId, "SALE", "CREATE", UUID.randomUUID(), payload,
                List.of(), Instant.parse("2026-08-11T02:00:00Z"));
    }

    private static final class CountingHandler implements SyncOperationHandler {
        private final ObjectMapper mapper;
        private final UUID serverEntityId = UUID.randomUUID();
        private int effects;

        private CountingHandler(ObjectMapper mapper) {
            this.mapper = mapper;
        }

        @Override
        public boolean supports(String entityType, String operationType) {
            return entityType.equals("SALE") && operationType.equals("CREATE");
        }

        @Override
        public HandlerResult handle(SyncOperationRequest request, SyncActor actor) {
            effects += 1;
            return new HandlerResult(serverEntityId, mapper.createObjectNode().put("effect", effects));
        }
    }

    private static final class InMemorySyncOperationPort implements SyncOperationPort {
        private final Map<String, StoredOperation> operations = new HashMap<>();

        @Override
        public Optional<StoredOperation> find(UUID deviceId, UUID clientOperationId) {
            return Optional.ofNullable(operations.get(key(deviceId, clientOperationId)));
        }

        @Override
        public boolean tryStart(NewOperation operation) {
            String key = key(operation.deviceId(), operation.clientOperationId());
            if (operations.containsKey(key)) return false;
            operations.put(key, new StoredOperation(operation.deviceId(), operation.clientOperationId(),
                    operation.payloadHash(), "PROCESSING", null, null, null, null, null));
            return true;
        }

        @Override
        public boolean tryRestart(UUID deviceId, UUID clientOperationId, String payloadHash) {
            return false;
        }

        @Override
        public boolean dependenciesCompleted(UUID deviceId, List<UUID> dependencies) {
            return dependencies.stream().allMatch(dependency -> find(deviceId, dependency)
                    .map(item -> item.resultStatus().equals("ACCEPTED") || item.resultStatus().equals("ALREADY_PROCESSED"))
                    .orElse(false));
        }

        @Override
        public void complete(UUID deviceId, UUID clientOperationId, CompletedOperation completed) {
            var previous = find(deviceId, clientOperationId).orElseThrow();
            operations.put(key(deviceId, clientOperationId), new StoredOperation(deviceId, clientOperationId,
                    previous.payloadHash(), "COMPLETED", completed.resultStatus(), completed.serverEntityId(),
                    completed.result(), completed.errorCode(), completed.errorMessage()));
        }

        private String key(UUID deviceId, UUID operationId) {
            return deviceId + ":" + operationId;
        }
    }
}
