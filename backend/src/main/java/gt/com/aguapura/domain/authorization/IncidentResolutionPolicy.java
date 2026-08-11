package gt.com.aguapura.domain.authorization;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.util.UUID;

public final class IncidentResolutionPolicy {
    private IncidentResolutionPolicy() {
    }

    public static String transition(String status, UUID reportedBy, UUID handledBy, String action) {
        if (reportedBy.equals(handledBy)) throw new BusinessException("INCIDENT_SELF_RESOLUTION",
                "Quien reporta no puede resolver su propia incidencia.", ErrorCategory.FORBIDDEN);
        return switch (action) {
            case "INVESTIGATE" -> {
                if (!"OPEN".equals(status)) throw invalidState();
                yield "INVESTIGATING";
            }
            case "RESOLVE" -> {
                if (!java.util.Set.of("OPEN", "INVESTIGATING").contains(status)) throw invalidState();
                yield "RESOLVED";
            }
            case "DISMISS" -> {
                if (!java.util.Set.of("OPEN", "INVESTIGATING").contains(status)) throw invalidState();
                yield "DISMISSED";
            }
            default -> throw new BusinessException("INCIDENT_ACTION_INVALID", "La acción no es válida.", ErrorCategory.VALIDATION);
        };
    }

    private static BusinessException invalidState() {
        return new BusinessException("INCIDENT_FINAL", "La incidencia ya tiene un estado final.", ErrorCategory.CONFLICT);
    }
}
