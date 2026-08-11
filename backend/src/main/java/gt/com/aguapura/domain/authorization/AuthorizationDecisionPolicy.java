package gt.com.aguapura.domain.authorization;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.time.Instant;
import java.util.UUID;

public final class AuthorizationDecisionPolicy {
    private AuthorizationDecisionPolicy() {
    }

    public static String decide(String status, UUID requestedBy, UUID decidedBy, Instant expiresAt,
                                Instant now, String decision) {
        if (!"REQUESTED".equals(status)) throw conflict("AUTHORIZATION_FINAL", "La solicitud ya tiene una decisión final.");
        if (requestedBy.equals(decidedBy)) throw new BusinessException("AUTHORIZATION_SELF_DECISION",
                "Quien solicita no puede decidir su propia autorización.", ErrorCategory.FORBIDDEN);
        if (!expiresAt.isAfter(now)) return "EXPIRED";
        return switch (decision) {
            case "APPROVE" -> "APPROVED";
            case "REJECT" -> "REJECTED";
            default -> throw new BusinessException("AUTHORIZATION_DECISION_INVALID",
                    "La decisión no es válida.", ErrorCategory.VALIDATION);
        };
    }

    private static BusinessException conflict(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.CONFLICT);
    }
}
