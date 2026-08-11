package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public interface DashboardPort {
    Metrics load(Instant startInclusive, Instant endExclusive, LocalDate operationalDate,
                 UUID actorId, boolean restrictedToSeller);

    record Metrics(BigDecimal salesToday, BigDecimal expectedCash, BigDecimal deliveredCash,
                   BigDecimal transfers, BigDecimal credit, BigDecimal monetaryDifferences,
                   BigDecimal inventoryDifferences, BigDecimal approvedWasteUnits,
                   long pendingWastes, long provisionalCustomers, long pendingTransfers,
                   long activeRoutes, long completedRoutes, long pendingOfflineOperations,
                   long pendingReturns, long pendingAuthorizations, long openIncidents) {
    }
}
