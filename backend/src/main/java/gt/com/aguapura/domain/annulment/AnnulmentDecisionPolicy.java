package gt.com.aguapura.domain.annulment;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.util.UUID;

public final class AnnulmentDecisionPolicy {
    private AnnulmentDecisionPolicy() {}

    public static String decide(String status, UUID requestedBy, UUID decidedBy, String decision) {
        if (!"REQUESTED".equals(status)) throw new BusinessException("ANNULMENT_FINAL",
                "La solicitud de anulación ya tiene una decisión final.", ErrorCategory.CONFLICT);
        if (requestedBy.equals(decidedBy)) throw new BusinessException("ANNULMENT_SELF_DECISION",
                "Quien solicita no puede aprobar su propia anulación.", ErrorCategory.FORBIDDEN);
        return switch (decision) {
            case "APPROVE" -> "APPROVED";
            case "REJECT" -> "REJECTED";
            default -> throw new BusinessException("ANNULMENT_DECISION_INVALID", "La decisión no es válida.", ErrorCategory.VALIDATION);
        };
    }
}
