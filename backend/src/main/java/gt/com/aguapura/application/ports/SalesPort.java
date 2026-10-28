package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SalesPort {
    Optional<SaleContext> findSaleContext(UUID routeId, UUID customerId);
    Optional<SaleContext> findDirectOfficeSaleContext(UUID customerId, UUID warehouseLocationId);
    Optional<UUID> findDefaultActiveWarehouseId();
    boolean isLoadStarted(UUID routeLoadId);
    boolean sellerAssignedToRoute(UUID userId, UUID routeId);
    Optional<PresentationView> findActivePresentation(UUID presentationId);
    SaleView createSale(NewSale sale);
    List<SaleView> findSales(Optional<UUID> sellerUserId);
    Optional<SaleView> findSale(UUID id, Optional<UUID> sellerUserId);

    /**
     * Returns the active (STARTED) route_load id for the given route, if any.
     * Used to validate that the route is currently in progress before registering a no-purchase visit.
     */
    Optional<UUID> findStartedRouteLoadId(UUID routeId);

    /**
     * Returns basic customer info if the customer is active and belongs to the given route.
     */
    Optional<CustomerRouteView> findCustomerInRoute(UUID customerId, UUID routeId);

    record CustomerRouteView(UUID customerId, String customerName) {}

    record SaleContext(UUID routeId, UUID inventoryLocationId, UUID routeLoadId, UUID sellerId, String customerType,
                       boolean creditAllowed, BigDecimal creditLimit, BigDecimal currentBalance) {
    }

    record PresentationView(UUID presentationId, String presentationCode, String presentationName,
                            UUID productId, String productCode, String productName,
                            BigDecimal conversionFactor) {
    }

    record NewSale(UUID id, UUID clientReference, String originType, UUID routeId, UUID routeLoadId,
                   UUID inventoryLocationId, UUID sellerId, UUID customerId, BigDecimal subtotal, BigDecimal total,
                   UUID createdBy, UUID deviceId, Instant createdAt, List<NewSaleItem> items, List<NewPayment> payments) {
        public NewSale(UUID id, UUID clientReference, UUID routeId, UUID inventoryLocationId,
                       UUID sellerId, UUID customerId, BigDecimal subtotal, BigDecimal total,
                       UUID createdBy, UUID deviceId, List<NewSaleItem> items, List<NewPayment> payments) {
            this(id, clientReference, "ROUTE", routeId, null, inventoryLocationId, sellerId, customerId,
                    subtotal, total, createdBy, deviceId, null, items, payments);
        }
    }

    record NewSaleItem(UUID id, UUID productId, UUID presentationId, BigDecimal presentationQuantity,
                       BigDecimal quantityBaseUnits, BigDecimal unitPrice, BigDecimal lineTotal,
                       String priceSource, UUID priceVersionId, UUID priceTierId, UUID specialPriceId) {
    }

    record NewPayment(UUID id, String method, BigDecimal amount, String status, String reference,
                      String bank, String evidenceReference) {
    }

    record SaleView(UUID id, UUID clientReference, String documentNumber, UUID routeId,
                    String routeCode, String routeName, UUID inventoryLocationId, UUID sellerId,
                    String sellerName, UUID customerId, String customerCode, String customerName,
                    String status, BigDecimal subtotal, BigDecimal total, String currencyCode,
                    String companyName, String companyTaxId, String companyAddress, String documentLegend,
                    UUID createdBy, String createdByUsername, UUID deviceId, Instant createdAt,
                    List<SaleItemView> items, List<PaymentView> payments, String originType) {
        public SaleView(UUID id, UUID clientReference, String documentNumber, UUID routeId,
                        String routeCode, String routeName, UUID inventoryLocationId, UUID sellerId,
                        String sellerName, UUID customerId, String customerCode, String customerName,
                        String status, BigDecimal subtotal, BigDecimal total, String currencyCode,
                        String companyName, String companyTaxId, String companyAddress, String documentLegend,
                        UUID createdBy, String createdByUsername, UUID deviceId, Instant createdAt,
                        List<SaleItemView> items, List<PaymentView> payments) {
            this(id, clientReference, documentNumber, routeId, routeCode, routeName, inventoryLocationId,
                    sellerId, sellerName, customerId, customerCode, customerName, status, subtotal, total,
                    currencyCode, companyName, companyTaxId, companyAddress, documentLegend, createdBy,
                    createdByUsername, deviceId, createdAt, items, payments, "ROUTE");
        }
    }

    record SaleItemView(UUID id, UUID productId, String productCode, String productName,
                        UUID presentationId, String presentationCode, String presentationName,
                        BigDecimal presentationQuantity, BigDecimal quantityBaseUnits,
                        BigDecimal unitPrice, BigDecimal lineTotal, String priceSource,
                        UUID priceVersionId, UUID priceTierId, UUID specialPriceId) {
    }

    record PaymentView(UUID id, String method, BigDecimal amount, String status, String reference,
                       String bank, String evidenceReference, UUID registeredBy, String registeredByUsername,
                       UUID verifiedBy, String verifiedByUsername, Instant verifiedAt, String rejectionReason,
                       Instant createdAt) {
    }
}
