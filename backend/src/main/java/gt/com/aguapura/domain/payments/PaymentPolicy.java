package gt.com.aguapura.domain.payments;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class PaymentPolicy {
    private static final Set<String> METHODS = Set.of("CASH", "TRANSFER", "CREDIT");

    private PaymentPolicy() {
    }

    public static List<Allocation> allocate(BigDecimal saleTotal, List<Request> requests) {
        if (saleTotal == null || saleTotal.signum() <= 0 || requests == null || requests.isEmpty()) {
            throw validation("PAYMENT_REQUIRED", "La venta debe incluir al menos un pago válido.");
        }
        var methods = new HashSet<String>();
        BigDecimal explicitTotal = BigDecimal.ZERO;
        int unassigned = 0;
        for (var request : requests) {
            if (request == null || !METHODS.contains(request.method()) || !methods.add(request.method())) {
                throw validation("PAYMENT_METHOD_INVALID", "Los medios de pago deben ser válidos y no repetirse.");
            }
            if (request.amount() == null) {
                unassigned++;
            } else if (request.amount().signum() <= 0) {
                throw validation("PAYMENT_AMOUNT_INVALID", "Cada monto de pago debe ser mayor que cero.");
            } else {
                explicitTotal = explicitTotal.add(request.amount());
            }
            if ("TRANSFER".equals(request.method()) && blank(request.reference())) {
                throw validation("TRANSFER_REFERENCE_REQUIRED", "La transferencia requiere una referencia.");
            }
        }
        if (unassigned > 1) {
            throw validation("PAYMENT_AMOUNT_REQUIRED", "Solo un medio puede usar el saldo restante de la venta.");
        }
        BigDecimal normalizedTotal = saleTotal.setScale(2, RoundingMode.HALF_UP);
        BigDecimal remainder = normalizedTotal.subtract(explicitTotal).setScale(2, RoundingMode.HALF_UP);
        if ((unassigned == 0 && explicitTotal.compareTo(normalizedTotal) != 0)
                || (unassigned == 1 && remainder.signum() <= 0)) {
            throw validation("PAYMENT_TOTAL_MISMATCH", "La suma de pagos debe coincidir exactamente con el total de la venta.");
        }
        var result = new ArrayList<Allocation>();
        for (var request : requests) {
            BigDecimal amount = request.amount() == null ? remainder : request.amount().setScale(2, RoundingMode.HALF_UP);
            String status = switch (request.method()) {
                case "CASH" -> "CONFIRMED";
                case "TRANSFER" -> "PENDING_VERIFICATION";
                case "CREDIT" -> "APPLIED";
                default -> throw new IllegalStateException("Método validado desconocido.");
            };
            result.add(new Allocation(request.method(), amount, status, text(request.reference()),
                    text(request.bank()), text(request.evidenceReference())));
        }
        return List.copyOf(result);
    }

    public static void validateCredit(String customerType, boolean creditAllowed, BigDecimal creditLimit,
                                      BigDecimal currentBalance, BigDecimal creditAmount) {
        if (creditAmount == null || creditAmount.signum() <= 0) {
            return;
        }
        if (!"PERMANENT".equals(customerType)) {
            throw validation("CREDIT_CUSTOMER_TYPE_FORBIDDEN", "El crédito solo está disponible para clientes permanentes.");
        }
        if (!creditAllowed) {
            throw validation("CREDIT_NOT_AUTHORIZED", "El cliente no tiene crédito autorizado.");
        }
        if (creditLimit == null || currentBalance == null
                || currentBalance.add(creditAmount).compareTo(creditLimit) > 0) {
            throw validation("CREDIT_LIMIT_EXCEEDED", "El crédito excede el límite disponible del cliente.");
        }
    }

    public static String transferDecision(String currentStatus, UUID registeredBy, UUID decidedBy,
                                          boolean approve, String rejectionReason) {
        if (!"PENDING_VERIFICATION".equals(currentStatus)) {
            throw new BusinessException("TRANSFER_ALREADY_DECIDED", "La transferencia ya fue revisada.",
                    ErrorCategory.CONFLICT);
        }
        if (registeredBy == null || registeredBy.equals(decidedBy)) {
            throw new BusinessException("TRANSFER_SELF_VERIFICATION_FORBIDDEN",
                    "La misma persona que registró la transferencia no puede verificarla.",
                    ErrorCategory.FORBIDDEN);
        }
        if (!approve && blank(rejectionReason)) {
            throw validation("TRANSFER_REJECTION_REASON_REQUIRED", "El rechazo requiere un motivo.");
        }
        return approve ? "VERIFIED" : "REJECTED";
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    public record Request(String method, BigDecimal amount, String reference, String bank,
                          String evidenceReference) {
    }

    public record Allocation(String method, BigDecimal amount, String status, String reference, String bank,
                             String evidenceReference) {
    }
}
