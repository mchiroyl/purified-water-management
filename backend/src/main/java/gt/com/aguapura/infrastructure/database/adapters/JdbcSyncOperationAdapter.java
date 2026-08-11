package gt.com.aguapura.infrastructure.database.adapters;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import gt.com.aguapura.application.ports.SyncOperationPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcSyncOperationAdapter implements SyncOperationPort {
    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public JdbcSyncOperationAdapter(JdbcClient jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public Optional<StoredOperation> find(UUID deviceId, UUID clientOperationId) {
        return jdbc.sql("""
                SELECT device_id,client_operation_id,payload_hash,processing_status,result_status,
                       server_entity_id,result_payload,error_code,error_message
                FROM sync_operation WHERE device_id=:deviceId AND client_operation_id=:operationId
                """).param("deviceId", deviceId).param("operationId", clientOperationId)
                .query((rs, row) -> new StoredOperation(rs.getObject("device_id", UUID.class),
                        rs.getObject("client_operation_id", UUID.class), rs.getString("payload_hash"),
                        rs.getString("processing_status"), rs.getString("result_status"),
                        rs.getObject("server_entity_id", UUID.class), readJson(rs.getString("result_payload")),
                        rs.getString("error_code"), rs.getString("error_message"))).optional();
    }

    @Override
    public boolean tryStart(NewOperation operation) {
        int inserted = jdbc.sql("""
                INSERT INTO sync_operation(id,device_id,client_operation_id,user_id,entity_type,operation_type,
                    aggregate_local_id,payload,payload_hash,dependencies,created_at_local)
                VALUES (:id,:deviceId,:operationId,:userId,:entityType,:operationType,:aggregateLocalId,
                    CAST(:payload AS jsonb),:payloadHash,CAST(:dependencies AS jsonb),:createdAtLocal)
                ON CONFLICT (device_id,client_operation_id) DO NOTHING
                """).param("id", operation.id()).param("deviceId", operation.deviceId())
                .param("operationId", operation.clientOperationId()).param("userId", operation.userId())
                .param("entityType", operation.entityType()).param("operationType", operation.operationType())
                .param("aggregateLocalId", operation.aggregateLocalId()).param("payload", json(operation.payload()))
                .param("payloadHash", operation.payloadHash()).param("dependencies", json(operation.dependencies()))
                .param("createdAtLocal", databaseTimestamp(operation.createdAtLocal())).update();
        return inserted == 1;
    }

    @Override
    public boolean tryRestart(UUID deviceId, UUID clientOperationId, String payloadHash) {
        return jdbc.sql("""
                UPDATE sync_operation SET processing_status='PROCESSING',result_status=NULL,server_entity_id=NULL,
                    result_payload=NULL,error_code=NULL,error_message=NULL,processed_at_server=NULL
                WHERE device_id=:deviceId AND client_operation_id=:operationId AND payload_hash=:payloadHash
                  AND processing_status='COMPLETED' AND result_status='RETRY'
                """).param("deviceId", deviceId).param("operationId", clientOperationId)
                .param("payloadHash", payloadHash).update() == 1;
    }

    @Override
    public boolean dependenciesCompleted(UUID deviceId, List<UUID> dependencies) {
        return dependencies.stream().allMatch(dependency -> find(deviceId, dependency)
                .map(operation -> "ACCEPTED".equals(operation.resultStatus())
                        || "ALREADY_PROCESSED".equals(operation.resultStatus()))
                .orElse(false));
    }

    @Override
    public void complete(UUID deviceId, UUID clientOperationId, CompletedOperation completed) {
        int updated = jdbc.sql("""
                UPDATE sync_operation SET processing_status='COMPLETED',result_status=:resultStatus,
                    server_entity_id=:serverEntityId,result_payload=CAST(:result AS jsonb),error_code=:errorCode,
                    error_message=:errorMessage,processed_at_server=now()
                WHERE device_id=:deviceId AND client_operation_id=:operationId AND processing_status='PROCESSING'
                """).param("resultStatus", completed.resultStatus()).param("serverEntityId", completed.serverEntityId())
                .param("result", completed.result() == null ? null : json(completed.result()))
                .param("errorCode", completed.errorCode()).param("errorMessage", completed.errorMessage())
                .param("deviceId", deviceId).param("operationId", clientOperationId).update();
        if (updated != 1) throw new IllegalStateException("No se pudo almacenar el resultado idempotente.");
    }

    private JsonNode readJson(String value) {
        if (value == null) return null;
        try {
            return mapper.readTree(value);
        } catch (JacksonException exception) {
            throw new IllegalStateException("Resultado de sincronización inválido en base de datos.", exception);
        }
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw new IllegalArgumentException("No fue posible serializar la operación de sincronización.", exception);
        }
    }

    static OffsetDateTime databaseTimestamp(Instant value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }
}
