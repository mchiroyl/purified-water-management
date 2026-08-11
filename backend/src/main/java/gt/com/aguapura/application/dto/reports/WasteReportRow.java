package gt.com.aguapura.application.dto.reports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record WasteReportRow(UUID wasteId, Instant occurredAt, String sellerCode, String sellerName,
                             String routeCode, String routeName, String productCode, String productName,
                             String presentationCode, String presentationName, String wasteType,
                             BigDecimal reportedUnits, BigDecimal approvedUnits, String status, String reason) {
}
