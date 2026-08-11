package gt.com.aguapura.application.services;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.SerializationFeature;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationResult;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import gt.com.aguapura.application.ports.SyncOperationPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class SyncOperationApplicationService {
    private final SyncOperationPort persistence;
    private final List<SyncOperationHandler> handlers;
    private final ObjectMapper mapper;

    public SyncOperationApplicationService(SyncOperationPort persistence, List<SyncOperationHandler> handlers,
                                           ObjectMapper mapper) {
        this.persistence = persistence;
        this.handlers = List.copyOf(handlers);
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SyncOperationResult process(SyncOperationRequest request, UUID actorId, UUID authenticatedDeviceId,
                                       boolean restrictedToSeller) {
        if (!authenticatedDeviceId.equals(request.deviceId())) {
            return result(request.clientOperationId(), "REJECTED", null, null, "SYNC_DEVICE_MISMATCH",
                    "El dispositivo de la operación no coincide con la sesión autenticada.");
        }
        String payloadHash = hash(request.payload());
        var existing = persistence.find(request.deviceId(), request.clientOperationId());
        if (existing.isPresent()) {
            var stored = existing.get();
            if (!stored.payloadHash().equals(payloadHash)) return payloadMismatch(request.clientOperationId());
            if (!"RETRY".equals(stored.resultStatus())) return replay(stored);
            if (!persistence.tryRestart(request.deviceId(), request.clientOperationId(), payloadHash)) {
                return replay(persistence.find(request.deviceId(), request.clientOperationId()).orElse(stored));
            }
        } else {
            var newOperation = new SyncOperationPort.NewOperation(UUID.randomUUID(), request.deviceId(),
                    request.clientOperationId(), actorId, request.entityType(), request.operationType(),
                    request.aggregateLocalId(), request.payload(), payloadHash, request.dependencies(),
                    request.createdAtLocal());
            if (!persistence.tryStart(newOperation)) {
                var concurrent = persistence.find(request.deviceId(), request.clientOperationId()).orElseThrow();
                if (!concurrent.payloadHash().equals(payloadHash)) return payloadMismatch(request.clientOperationId());
                return replay(concurrent);
            }
        }

        SyncOperationResult operationResult;
        if (!persistence.dependenciesCompleted(request.deviceId(), request.dependencies())) {
            operationResult = result(request.clientOperationId(), "RETRY", null, null,
                    "SYNC_DEPENDENCY_NOT_READY", "Una operación requerida todavía no está sincronizada.");
        } else {
            operationResult = execute(request, actorId, authenticatedDeviceId, restrictedToSeller);
        }
        persistence.complete(request.deviceId(), request.clientOperationId(), new SyncOperationPort.CompletedOperation(
                operationResult.status(), operationResult.serverEntityId(), operationResult.result(),
                operationResult.errorCode(), operationResult.message()));
        return operationResult;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SyncOperationResult recordFailure(SyncOperationRequest request, UUID actorId, UUID authenticatedDeviceId,
                                             String status, String errorCode, String message) {
        if (!authenticatedDeviceId.equals(request.deviceId())) {
            return result(request.clientOperationId(), "REJECTED", null, null, "SYNC_DEVICE_MISMATCH",
                    "El dispositivo de la operación no coincide con la sesión autenticada.");
        }
        String payloadHash = hash(request.payload());
        var existing = persistence.find(request.deviceId(), request.clientOperationId());
        if (existing.isPresent()) {
            if (!existing.get().payloadHash().equals(payloadHash)) return payloadMismatch(request.clientOperationId());
            return replay(existing.get());
        }
        var newOperation = new SyncOperationPort.NewOperation(UUID.randomUUID(), request.deviceId(),
                request.clientOperationId(), actorId, request.entityType(), request.operationType(),
                request.aggregateLocalId(), request.payload(), payloadHash, request.dependencies(),
                request.createdAtLocal());
        if (!persistence.tryStart(newOperation)) {
            return replay(persistence.find(request.deviceId(), request.clientOperationId()).orElseThrow());
        }
        var failure = result(request.clientOperationId(), status, null, null, errorCode, message);
        persistence.complete(request.deviceId(), request.clientOperationId(), new SyncOperationPort.CompletedOperation(
                status, null, null, errorCode, message));
        return failure;
    }

    private SyncOperationResult execute(SyncOperationRequest request, UUID actorId, UUID deviceId,
                                        boolean restrictedToSeller) {
        var handler = handlers.stream().filter(candidate -> candidate.supports(request.entityType(),
                request.operationType())).findFirst().orElseThrow(() -> new BusinessException(
                "SYNC_OPERATION_UNSUPPORTED", "La operación no está habilitada para sincronización.",
                ErrorCategory.VALIDATION));
        var handled = handler.handle(request, new SyncOperationHandler.SyncActor(actorId, deviceId,
                restrictedToSeller));
        return result(request.clientOperationId(), "ACCEPTED", handled.serverEntityId(), handled.result(),
                null, null);
    }

    private SyncOperationResult replay(SyncOperationPort.StoredOperation stored) {
        if (stored.resultStatus() == null || "PROCESSING".equals(stored.processingStatus())) {
            return result(stored.clientOperationId(), "RETRY", null, null, "SYNC_OPERATION_IN_PROGRESS",
                    "La operación se está procesando.");
        }
        String status = "ACCEPTED".equals(stored.resultStatus()) ? "ALREADY_PROCESSED" : stored.resultStatus();
        return result(stored.clientOperationId(), status, stored.serverEntityId(), stored.result(),
                stored.errorCode(), stored.errorMessage());
    }

    private SyncOperationResult payloadMismatch(UUID operationId) {
        return result(operationId, "CONFLICT", null, null, "IDEMPOTENCY_PAYLOAD_MISMATCH",
                "El identificador de operación ya fue utilizado con datos diferentes.");
    }

    private SyncOperationResult result(UUID operationId, String status, UUID serverEntityId, JsonNode payload,
                                       String errorCode, String message) {
        return new SyncOperationResult(operationId, status, serverEntityId, payload, errorCode, message, Instant.now());
    }

    private String hash(JsonNode payload) {
        try {
            Object canonical = mapper.convertValue(payload, Object.class);
            byte[] bytes = mapper.writer().with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                    .writeValueAsBytes(canonical);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (JacksonException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("No fue posible calcular la huella de la operación.", exception);
        }
    }
}
