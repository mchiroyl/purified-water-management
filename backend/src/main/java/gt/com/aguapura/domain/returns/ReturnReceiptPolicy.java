package gt.com.aguapura.domain.returns;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.math.BigDecimal;
import java.util.Set;

public final class ReturnReceiptPolicy {
    private static final Set<String> RECEIVER_ROLES = Set.of("BODEGA", "SUPERVISOR", "ADMINISTRADOR");

    private ReturnReceiptPolicy() {
    }

    public static ReceiptResult confirm(String currentStatus, String role, BigDecimal reportedBaseUnits,
                                        BigDecimal receivedBaseUnits) {
        if (!RECEIVER_ROLES.contains(role)) throw new BusinessException("RETURN_RECEIPT_ROLE",
                "El vendedor no puede confirmar una recepción de bodega.", ErrorCategory.FORBIDDEN);
        if (!"PENDING_RECEIPT".equals(currentStatus)) throw new BusinessException("RETURN_ALREADY_RECEIVED",
                "La devolución ya tiene una recepción definitiva.", ErrorCategory.CONFLICT);
        if (reportedBaseUnits == null || reportedBaseUnits.signum() <= 0 || receivedBaseUnits == null
                || receivedBaseUnits.signum() < 0 || receivedBaseUnits.compareTo(reportedBaseUnits) > 0) {
            throw new BusinessException("RETURN_RECEIVED_QUANTITY",
                    "La cantidad recibida debe estar entre cero y la reportada.", ErrorCategory.VALIDATION);
        }
        String status = receivedBaseUnits.signum() == 0 ? "REJECTED"
                : receivedBaseUnits.compareTo(reportedBaseUnits) == 0 ? "RECEIVED" : "PARTIALLY_RECEIVED";
        return new ReceiptResult(status, receivedBaseUnits, reportedBaseUnits.subtract(receivedBaseUnits));
    }

    public record ReceiptResult(String status, BigDecimal receivedBaseUnits,
                                BigDecimal pendingDifferenceBaseUnits) {
    }
}
