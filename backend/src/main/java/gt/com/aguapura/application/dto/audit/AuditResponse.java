package gt.com.aguapura.application.dto.audit;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record AuditResponse(UUID id, UUID userId, String username, UUID deviceId, String deviceName,
                            String action, String entityType, UUID entityId,
                            Map<String, Object> beforeData, Map<String, Object> afterData,
                            UUID correlationId, String ipAddress, Instant occurredAt) {
}
