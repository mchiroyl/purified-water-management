package gt.com.aguapura.application.dto.dashboard;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record DashboardResponse(
        Instant generatedAt, String timezone, String currencyCode,
        BigDecimal salesToday, BigDecimal expectedCash, BigDecimal deliveredCash,
        BigDecimal transfers, BigDecimal credit, BigDecimal monetaryDifferences,
        BigDecimal inventoryDifferences, BigDecimal approvedWasteUnits,
        long pendingWastes, long provisionalCustomers, long pendingTransfers,
        long activeRoutes, long completedRoutes, long pendingOfflineOperations,
        long pendingReturns, long pendingAuthorizations, long openIncidents,
        List<DashboardAlertResponse> alerts) {

    public record DashboardAlertResponse(String code, String severity, String title, long count) {
    }
}
