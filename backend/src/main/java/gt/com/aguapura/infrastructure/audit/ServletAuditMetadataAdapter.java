package gt.com.aguapura.infrastructure.audit;

import gt.com.aguapura.application.ports.AuditMetadataPort;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

@Component
public class ServletAuditMetadataAdapter implements AuditMetadataPort {
    @Override
    public Metadata current() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            var request = attributes.getRequest();
            Object raw = request.getAttribute("correlationId");
            UUID correlation = parse(raw == null ? null : raw.toString());
            return new Metadata(correlation, safeIp(request.getRemoteAddr()));
        }
        return new Metadata(UUID.randomUUID(), null);
    }

    private UUID parse(String raw) {
        try { return raw == null ? UUID.randomUUID() : UUID.fromString(raw); }
        catch (IllegalArgumentException ignored) { return UUID.randomUUID(); }
    }

    private String safeIp(String value) {
        if (value == null || value.isBlank()) return null;
        return value.length() > 64 ? value.substring(0, 64) : value;
    }
}
