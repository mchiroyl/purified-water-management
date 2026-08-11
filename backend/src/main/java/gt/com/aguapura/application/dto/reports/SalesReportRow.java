package gt.com.aguapura.application.dto.reports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SalesReportRow(UUID saleId, String documentNumber, Instant occurredAt,
                             String sellerCode, String sellerName, String routeCode, String routeName,
                             String customerCode, String customerName, String productCode, String productName,
                             String presentationCode, String presentationName, BigDecimal presentationQuantity,
                             BigDecimal baseUnits, BigDecimal unitPrice, BigDecimal lineTotal, BigDecimal saleTotal,
                             String currencyCode, String paymentMethods, BigDecimal cashAmount,
                             BigDecimal transferAmount, BigDecimal creditAmount, String saleStatus) {
}
