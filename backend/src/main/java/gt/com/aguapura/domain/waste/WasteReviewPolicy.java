package gt.com.aguapura.domain.waste;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.math.BigDecimal;
import java.util.Set;

public final class WasteReviewPolicy {
    private static final Set<String> REVIEW_ROLES = Set.of("BODEGA", "SUPERVISOR", "ADMINISTRADOR");

    private WasteReviewPolicy() {
    }

    public static ReviewResult review(String currentStatus, String role, boolean ownWaste,
                                      BigDecimal reportedBaseUnits, BigDecimal approvedBaseUnits,
                                      BigDecimal warehouseLimitBaseUnits, BigDecimal supervisorLimitBaseUnits,
                                      boolean pendingRequiresAdministrator) {
        if (!REVIEW_ROLES.contains(role)) {
            throw forbidden("WASTE_REVIEW_ROLE", "El vendedor no puede revisar ni aprobar mermas.");
        }
        if (ownWaste) {
            throw forbidden("WASTE_SELF_REVIEW", "Nadie puede aprobar su propia merma.");
        }
        if (!Set.of("PENDING_REVIEW", "PENDING_SECOND_APPROVAL").contains(currentStatus)) {
            throw conflict("WASTE_ALREADY_REVIEWED", "La merma ya tiene una decisión definitiva.");
        }
        if (reportedBaseUnits == null || reportedBaseUnits.signum() <= 0 || approvedBaseUnits == null
                || approvedBaseUnits.signum() < 0 || approvedBaseUnits.compareTo(reportedBaseUnits) > 0) {
            throw validation("WASTE_APPROVED_QUANTITY", "Las unidades aprobadas deben estar entre cero y lo reportado.");
        }
        if ("PENDING_SECOND_APPROVAL".equals(currentStatus)) {
            String required = pendingRequiresAdministrator ? "ADMINISTRADOR" : "SUPERVISOR";
            if (!role.equals(required) && !role.equals("ADMINISTRADOR")) {
                throw forbidden("WASTE_SECOND_REVIEW_ROLE", pendingRequiresAdministrator
                        ? "La segunda aprobación requiere un administrador."
                        : "La segunda aprobación requiere supervisor o administrador.");
            }
            return finalResult(reportedBaseUnits, approvedBaseUnits);
        }
        if (!role.equals("BODEGA") && approvedBaseUnits.compareTo(warehouseLimitBaseUnits) > 0) {
            throw forbidden("WASTE_WAREHOUSE_FIRST_REVIEW",
                    "La merma superior al límite requiere primero la revisión de bodega.");
        }
        if (role.equals("BODEGA") && approvedBaseUnits.compareTo(warehouseLimitBaseUnits) > 0) {
            String required = approvedBaseUnits.compareTo(supervisorLimitBaseUnits) <= 0
                    ? "SUPERVISOR" : "ADMINISTRADOR";
            return new ReviewResult("PENDING_SECOND_APPROVAL", approvedBaseUnits,
                    reportedBaseUnits.subtract(approvedBaseUnits), required, false);
        }
        return finalResult(reportedBaseUnits, approvedBaseUnits);
    }

    private static ReviewResult finalResult(BigDecimal reported, BigDecimal approved) {
        String status = approved.signum() == 0 ? "REJECTED"
                : approved.compareTo(reported) == 0 ? "APPROVED" : "PARTIALLY_APPROVED";
        return new ReviewResult(status, approved, reported.subtract(approved), null, true);
    }

    private static BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    private static BusinessException forbidden(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.FORBIDDEN);
    }

    private static BusinessException conflict(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.CONFLICT);
    }

    public record ReviewResult(String status, BigDecimal approvedBaseUnits,
                               BigDecimal pendingDifferenceBaseUnits, String requiredRole,
                               boolean finalDecision) {
    }
}
