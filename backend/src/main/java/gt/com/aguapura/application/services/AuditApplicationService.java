package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.audit.AuditResponse;
import gt.com.aguapura.application.dto.reports.ReportPageResponse;
import gt.com.aguapura.application.ports.AuditMetadataPort;
import gt.com.aguapura.application.ports.AuditPort;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.domain.audit.AuditDataSanitizer;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.reports.ReportDateRange;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditApplicationService {
    private final AuditPort persistence;
    private final AuditMetadataPort metadata;
    private final CompanyConfigurationPersistencePort company;

    public AuditApplicationService(AuditPort persistence, AuditMetadataPort metadata,
                                   CompanyConfigurationPersistencePort company) {
        this.persistence = persistence;
        this.metadata = metadata;
        this.company = company;
    }

    @Transactional
    public void record(UUID actorId, UUID deviceId, String action, String entityType, UUID entityId,
                       Map<String, ?> beforeData, Map<String, ?> afterData) {
        String safeAction = code(action, "AUDIT_ACTION_INVALID");
        String safeEntity = code(entityType, "AUDIT_ENTITY_INVALID");
        var request = metadata.current();
        persistence.append(new AuditPort.Event(actorId, deviceId, safeAction, safeEntity, entityId,
                AuditDataSanitizer.sanitize(beforeData), AuditDataSanitizer.sanitize(afterData),
                request.correlationId(), request.ipAddress()));
    }

    @Transactional
    public ReportPageResponse<AuditResponse> search(LocalDate from, LocalDate to, String action,
                                                     String entityType, String user, String correlationId,
                                                     int page, int size, UUID actorId, UUID deviceId) {
        if (page < 0 || size < 1 || size > 100) throw validation("INVALID_AUDIT_PAGE", "La paginación no es válida.");
        var configuration = company.find().orElseThrow(() -> validation(
                "COMPANY_CONFIGURATION_NOT_FOUND", "Configure los datos de la empresa."));
        var range = ReportDateRange.of(from, to, ZoneId.of(configuration.timezone()), Clock.systemUTC());
        UUID correlation = null;
        if (correlationId != null && !correlationId.isBlank()) {
            try { correlation = UUID.fromString(correlationId.trim()); }
            catch (IllegalArgumentException exception) {
                throw validation("INVALID_CORRELATION_ID", "El identificador de correlación no es válido.");
            }
        }
        var result = persistence.search(new AuditPort.Query(range.startInclusive(), range.endExclusive(),
                filter(action), filter(entityType), filter(user), correlation, page, size));
        record(actorId, deviceId, "AUDIT_VIEW", "AUDIT_LOG", null, Map.of(),
                Map.of("from", range.startInclusive().toString(), "to", range.endExclusive().toString(),
                        "resultCount", result.content().size()));
        return new ReportPageResponse<>(result.content().stream().map(this::response).toList(),
                result.totalElements(), result.page(), result.size(), result.hasNext());
    }

    private AuditResponse response(AuditPort.Row row) {
        return new AuditResponse(row.id(), row.userId(), row.username(), row.deviceId(), row.deviceName(),
                row.action(), row.entityType(), row.entityId(), row.beforeData(), row.afterData(),
                row.correlationId(), row.ipAddress(), row.occurredAt());
    }

    private String code(String raw, String error) {
        String value = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if (!value.matches("[A-Z][A-Z0-9_]{1,79}")) throw validation(error, "El código de auditoría no es válido.");
        return value;
    }

    private String filter(String value) {
        if (value == null) return "";
        String clean = value.trim();
        if (clean.length() > 100) throw validation("AUDIT_FILTER_TOO_LONG", "Un filtro supera 100 caracteres.");
        return clean;
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }
}
