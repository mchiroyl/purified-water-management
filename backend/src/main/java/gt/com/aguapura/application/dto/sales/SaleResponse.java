package gt.com.aguapura.application.dto.sales;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SaleResponse(
        UUID id,
        UUID clientReference,
        String documentNumber,
        UUID routeId,
        String routeCode,
        String routeName,
        UUID sellerId,
        String sellerName,
        UUID customerId,
        String customerCode,
        String customerName,
        String status,
        BigDecimal subtotal,
        BigDecimal total,
        String currencyCode,
        String companyName,
        String companyTaxId,
        String companyAddress,
        String documentLegend,
        UUID createdBy,
        String createdByUsername,
        UUID deviceId,
        Instant createdAt,
        List<ItemResponse> items
) {
    public record ItemResponse(UUID id, UUID productId, String productCode, String productName,
                               UUID presentationId, String presentationCode, String presentationName,
                               BigDecimal presentationQuantity, BigDecimal quantityBaseUnits,
                               BigDecimal unitPrice, BigDecimal lineTotal, String priceSource,
                               UUID priceVersionId, UUID priceTierId, UUID specialPriceId) {
    }
}
