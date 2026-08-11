package gt.com.aguapura.domain.waste;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WasteReviewPolicyTest {

    @Test
    void sellerCanNeverReviewWaste() {
        assertThatThrownBy(() -> WasteReviewPolicy.review("PENDING_REVIEW", "VENDEDOR",
                false, new BigDecimal("5"), new BigDecimal("5"), new BigDecimal("2"),
                new BigDecimal("10"), false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("vendedor");
    }

    @Test
    void reporterCanNeverApproveOwnWaste() {
        assertThatThrownBy(() -> WasteReviewPolicy.review("PENDING_REVIEW", "BODEGA",
                true, new BigDecimal("5"), new BigDecimal("5"), new BigDecimal("10"),
                new BigDecimal("20"), false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("propia merma");
    }

    @Test
    void warehouseApprovesSmallWasteAndPreservesUnapprovedDifference() {
        var result = WasteReviewPolicy.review("PENDING_REVIEW", "BODEGA", false,
                new BigDecimal("5"), new BigDecimal("2"), new BigDecimal("3"),
                new BigDecimal("10"), false);

        assertThat(result.status()).isEqualTo("PARTIALLY_APPROVED");
        assertThat(result.approvedBaseUnits()).isEqualByComparingTo("2");
        assertThat(result.pendingDifferenceBaseUnits()).isEqualByComparingTo("3");
        assertThat(result.finalDecision()).isTrue();
    }

    @Test
    void warehouseEscalatesMediumAndExtraordinaryWaste() {
        var medium = WasteReviewPolicy.review("PENDING_REVIEW", "BODEGA", false,
                new BigDecimal("8"), new BigDecimal("8"), new BigDecimal("3"),
                new BigDecimal("10"), false);
        var extraordinary = WasteReviewPolicy.review("PENDING_REVIEW", "BODEGA", false,
                new BigDecimal("15"), new BigDecimal("15"), new BigDecimal("3"),
                new BigDecimal("10"), false);

        assertThat(medium.status()).isEqualTo("PENDING_SECOND_APPROVAL");
        assertThat(medium.requiredRole()).isEqualTo("SUPERVISOR");
        assertThat(extraordinary.requiredRole()).isEqualTo("ADMINISTRADOR");
    }

    @Test
    void mediumOrExtraordinaryWasteRequiresWarehouseFirstReview() {
        assertThatThrownBy(() -> WasteReviewPolicy.review("PENDING_REVIEW", "SUPERVISOR", false,
                new BigDecimal("8"), new BigDecimal("8"), new BigDecimal("3"),
                new BigDecimal("10"), false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("bodega");
    }

    @Test
    void secondReviewerMustHaveRequiredRole() {
        assertThatThrownBy(() -> WasteReviewPolicy.review("PENDING_SECOND_APPROVAL", "SUPERVISOR",
                false, new BigDecimal("15"), new BigDecimal("15"), new BigDecimal("3"),
                new BigDecimal("10"), true))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("administrador");

        var approved = WasteReviewPolicy.review("PENDING_SECOND_APPROVAL", "ADMINISTRADOR",
                false, new BigDecimal("15"), new BigDecimal("15"), new BigDecimal("3"),
                new BigDecimal("10"), true);
        assertThat(approved.status()).isEqualTo("APPROVED");
    }

    @Test
    void approvedUnitsCannotExceedReportedUnits() {
        assertThatThrownBy(() -> WasteReviewPolicy.review("PENDING_REVIEW", "BODEGA", false,
                new BigDecimal("3"), new BigDecimal("4"), new BigDecimal("10"),
                new BigDecimal("20"), false))
                .isInstanceOf(BusinessException.class);
    }
}
