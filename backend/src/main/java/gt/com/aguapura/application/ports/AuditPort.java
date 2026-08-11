package gt.com.aguapura.application.ports;

import gt.com.aguapura.application.dto.reports.ReportPageResponse;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public interface AuditPort {
    void append(Event event);
    ReportPageResponse<Row> search(Query query);

    record Event(UUID userId, UUID deviceId, String action, String entityType, UUID entityId,
                 Map<String, Object> beforeData, Map<String, Object> afterData,
                 UUID correlationId, String ipAddress) {
    }

    record Query(Instant startInclusive, Instant endExclusive, String action, String entityType,
                 String user, UUID correlationId, int page, int size) {
    }

    record Row(UUID id, UUID userId, String username, UUID deviceId, String deviceName, String action,
               String entityType, UUID entityId, Map<String, Object> beforeData, Map<String, Object> afterData,
               UUID correlationId, String ipAddress, Instant occurredAt) {
    }
}
