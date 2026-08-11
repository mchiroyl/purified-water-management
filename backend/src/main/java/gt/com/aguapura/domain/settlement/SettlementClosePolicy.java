package gt.com.aguapura.domain.settlement;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.util.List;
import java.util.Set;

public final class SettlementClosePolicy {
    private static final Set<String> CLOSERS = Set.of("ADMINISTRADOR", "SUPERVISOR");

    private SettlementClosePolicy() {
    }

    public static void validate(String loadStatus, String role, int pendingLocalOperations,
                                List<String> serverBlockers, String notes) {
        if (!CLOSERS.contains(role)) throw new BusinessException("SETTLEMENT_CLOSE_ROLE",
                "El rol no puede cerrar liquidaciones.", ErrorCategory.FORBIDDEN);
        if (!"STARTED".equals(loadStatus)) throw new BusinessException("SETTLEMENT_LOAD_NOT_OPEN",
                "La carga de ruta no está abierta para liquidación.", ErrorCategory.CONFLICT);
        if (pendingLocalOperations < 0) throw new BusinessException("SETTLEMENT_LOCAL_COUNT_INVALID",
                "El número de operaciones locales no es válido.", ErrorCategory.VALIDATION);
        if (pendingLocalOperations > 0 || (serverBlockers != null && !serverBlockers.isEmpty())) {
            throw new BusinessException("SETTLEMENT_SYNC_PENDING",
                    "Existen operaciones pendientes de sincronización.", ErrorCategory.CONFLICT);
        }
        if (notes == null || notes.trim().isEmpty()) throw new BusinessException("SETTLEMENT_NOTES_REQUIRED",
                "El cierre requiere notas de revisión.", ErrorCategory.VALIDATION);
    }
}
