package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SalesPort {
    Optional<SaleContext> findSaleContext(UUID routeId, UUID customerId);
    boolean sellerAssignedToRoute(UUID userId, UUID routeId);
    Optional<PresentationView> findActivePresentation(UUID presentationId);
    SaleView createSale(NewSale sale);
    List<SaleView> findSales(Optional<UUID> sellerUserId);
    Optional<SaleView> findSale(UUID id, Optional<UUID> sellerUserId);

    record SaleContext(UUID routeId, UUID inventoryLocationId, UUID sellerId) {
    }

    record PresentationView(UUID presentationId, String presentationCode, String presentationName,
                            UUID productId, String productCode, String productName,
                            BigDecimal conversionFactor) {
    }

    record NewSale(UUID id, UUID clientReference, UUID routeId, UUID inventoryLocationId,
                   UUID sellerId, UUID customerId, BigDecimal subtotal, BigDecimal total,
                   UUID createdBy, UUID deviceId, List<NewSaleItem> items) {
    }

    record NewSaleItem(UUID id, UUID productId, UUID presentationId, BigDecimal presentationQuantity,
                       BigDecimal quantityBaseUnits, BigDecimal unitPrice, BigDecimal lineTotal,
                       String priceSource, UUID priceVersionId, UUID priceTierId, UUID specialPriceId) {
    }

    record SaleView(UUID id, UUID clientReference, String documentNumber, UUID routeId,
                    String routeCode, String routeName, UUID inventoryLocationId, UUID sellerId,
                    String sellerName, UUID customerId, String customerCode, String customerName,
                    String status, BigDecimal subtotal, BigDecimal total, String currencyCode,
                    String companyName, String companyTaxId, String companyAddress, String documentLegend,
                    UUID createdBy, String createdByUsername, UUID deviceId, Instant createdAt,
                    List<SaleItemView> items) {
    }

    record SaleItemView(UUID id, UUID productId, String productCode, String productName,
                        UUID presentationId, String presentationCode, String presentationName,
                        BigDecimal presentationQuantity, BigDecimal quantityBaseUnits,
                        BigDecimal unitPrice, BigDecimal lineTotal, String priceSource,
                        UUID priceVersionId, UUID priceTierId, UUID specialPriceId) {
    }
}
