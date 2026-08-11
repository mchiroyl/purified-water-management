package gt.com.aguapura.domain.settlement;

import java.math.BigDecimal;

public final class SettlementCalculator {
    private SettlementCalculator() {
    }

    public static ProductResult calculateProduct(BigDecimal loaded, BigDecimal sold,
                                                 BigDecimal returnedGood, BigDecimal approvedWaste) {
        requireNonNegative(loaded, sold, returnedGood, approvedWaste);
        return new ProductResult(loaded.subtract(sold).subtract(returnedGood).subtract(approvedWaste));
    }

    public static FinancialResult calculateFinancial(BigDecimal expectedCash, BigDecimal deliveredCash) {
        requireNonNegative(expectedCash, deliveredCash);
        return new FinancialResult(expectedCash.subtract(deliveredCash));
    }

    private static void requireNonNegative(BigDecimal... values) {
        for (var value : values) {
            if (value == null || value.signum() < 0) throw new IllegalArgumentException("Las fuentes deben ser no negativas.");
        }
    }

    public record ProductResult(BigDecimal physicalDifference) {
    }

    public record FinancialResult(BigDecimal monetaryDifference) {
    }
}
