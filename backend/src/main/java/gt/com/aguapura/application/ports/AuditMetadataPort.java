package gt.com.aguapura.application.ports;

import java.util.UUID;

public interface AuditMetadataPort {
    Metadata current();

    record Metadata(UUID correlationId, String ipAddress) {
    }
}
