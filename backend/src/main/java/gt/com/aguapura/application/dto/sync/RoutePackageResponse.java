package gt.com.aguapura.application.dto.sync;

import java.util.List;
import java.util.Map;

public record RoutePackageResponse(
        MetadataSnapshot metadata,
        UserContextSnapshot userContext,
        CompanyConfigurationSnapshot companyConfiguration,
        RoutePackageSnapshot routePackage,
        List<CustomerSnapshot> customers,
        List<ProductSnapshot> products,
        List<PresentationSnapshot> presentations,
        List<PriceVersionSnapshot> priceVersions,
        List<PriceTierSnapshot> priceTiers,
        List<SpecialPriceSnapshot> specialPrices,
        List<RouteLoadSnapshot> routeLoads,
        List<RouteLoadItemSnapshot> routeLoadItems,
        List<RouteInventoryRecord> routeInventory
) {
    public record MetadataSnapshot(String key, Object value, String updatedAt) {}

    public record UserContextSnapshot(String userId, String username, List<String> roles, String deviceId, String cachedAt) {}

    public record CompanyConfigurationSnapshot(
            String id,
            String commercialName,
            String legalName,
            String taxId,
            Map<String, String> contact,
            String logoCacheKey,
            String currencyCode,
            String timezone,
            String receiptPrefix,
            int serverVersion,
            String cachedAt
    ) {}

    public record RoutePackageSnapshot(
            String routeRunId,
            String routeId,
            String sellerId,
            String vehicleId,
            String status,
            String businessDate,
            String packageVersion,
            String downloadedAt,
            String expiresAt
    ) {}

    public record CustomerSnapshot(
            String id,
            String routeRunId,
            String code,
            String name,
            String normalizedPhone,
            String customerType,
            String status,
            boolean creditAllowed,
            String creditAvailable,
            String addressReference,
            String phone,
            String whatsapp,
            String confirmedLatitude,
            String confirmedLongitude,
            String cachedAt
    ) {}

    public record ProductSnapshot(
            String id,
            String code,
            String name,
            String baseUomId,
            boolean active,
            int activeIndex,
            boolean tracksInventory,
            int serverVersion
    ) {}

    public record PresentationSnapshot(
            String id,
            String productId,
            String code,
            String name,
            String unitsPerPresentation,
            boolean active,
            int activeIndex
    ) {}

    public record PriceVersionSnapshot(
            String id,
            String priceListId,
            int versionNumber,
            String validFrom,
            String validTo,
            String status
    ) {}

    public record PriceTierSnapshot(
            String id,
            String priceVersionId,
            String presentationId,
            String minBaseUnits,
            String maxBaseUnits,
            String unitPrice
    ) {}

    public record SpecialPriceSnapshot(
            String id,
            String customerId,
            String presentationId,
            String unitPrice,
            String validFrom,
            String validTo,
            String status
    ) {}

    public record RouteLoadSnapshot(
            String id,
            String routeRunId,
            String status,
            String sellerConfirmedAt,
            String serverVersion
    ) {}

    public record RouteLoadItemSnapshot(
            String id,
            String routeLoadId,
            String presentationId,
            String presentationQuantity,
            String quantityBaseUnits
    ) {}

    public record RouteInventoryRecord(
            String inventoryKey,
            String routeRunId,
            String productId,
            String availableBaseUnits,
            String pendingBaseUnits,
            int serverVersion,
            String updatedAt
    ) {}
}
