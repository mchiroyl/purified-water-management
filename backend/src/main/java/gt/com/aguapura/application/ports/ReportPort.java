package gt.com.aguapura.application.ports;

import gt.com.aguapura.application.dto.reports.ReportPageResponse;
import gt.com.aguapura.application.dto.reports.SalesReportRow;
import gt.com.aguapura.application.dto.reports.SettlementReportRow;
import gt.com.aguapura.application.dto.reports.WasteReportRow;

import java.time.Instant;
import java.util.UUID;

public interface ReportPort {
    ReportPageResponse<SalesReportRow> sales(Query query, UUID actorId, boolean restrictedToSeller);
    ReportPageResponse<WasteReportRow> wastes(Query query, UUID actorId, boolean restrictedToSeller);
    ReportPageResponse<SettlementReportRow> settlements(Query query, UUID actorId, boolean restrictedToSeller);

    record Query(Instant startInclusive, Instant endExclusive, String seller, String route,
                 String customer, String product, String presentation, String paymentMethod,
                 boolean differenceOnly, int page, int size) {
    }
}
