package gt.com.aguapura.domain.settlement;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class SettlementCalculatorTest {
    @Test
    void balancesPhysicalUnitsWithGoodReturnAndApprovedWaste() {
        var result = SettlementCalculator.calculateProduct(
                new BigDecimal("100"), new BigDecimal("60"), new BigDecimal("38"), new BigDecimal("2"));

        assertThat(result.physicalDifference()).isEqualByComparingTo("0");
    }

    @Test
    void preservesPhysicalDifferenceWhenWasteIsOnlyPartiallyApproved() {
        var result = SettlementCalculator.calculateProduct(
                new BigDecimal("100"), new BigDecimal("60"), new BigDecimal("38"), new BigDecimal("1"));

        assertThat(result.physicalDifference()).isEqualByComparingTo("1");
    }

    @Test
    void neverUsesWasteToHideMissingCash() {
        var result = SettlementCalculator.calculateFinancial(
                new BigDecimal("600"), new BigDecimal("400"));

        assertThat(result.monetaryDifference()).isEqualByComparingTo("200");
    }
}
