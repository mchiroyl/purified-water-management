package gt.com.aguapura.application.ports;

import gt.com.aguapura.domain.pricing.PricePolicy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PricingPort {
    boolean priceListCodeExists(String code);
    boolean presentationExists(UUID presentationId);
    boolean customerExists(UUID customerId);
    PriceListView createPriceList(NewPriceList item);
    List<PriceListView> findPriceLists();
    int nextVersionNumber(UUID priceListId);
    PriceListView createPriceVersion(NewPriceVersion item);
    PriceListView activatePriceVersion(UUID versionId, Instant activatedAt);
    SpecialPriceView createSpecialPrice(NewSpecialPrice item);
    List<SpecialPriceView> findSpecialPrices();
    Optional<PricePolicy.SpecialPrice> findSpecialPrice(UUID customerId, UUID presentationId, Instant at);
    List<PricePolicy.Tier> findApplicableTiers(UUID presentationId, Instant at);
    DiscountView createDiscount(NewDiscount item);
    List<DiscountView> findDiscounts();
    Optional<DiscountView> findDiscount(UUID id);
    DiscountView decideDiscount(UUID id, String decision, UUID actorId, Instant decidedAt);

    record NewPriceList(String code, String name, String currencyCode) {}
    record NewPriceVersion(UUID priceListId, int versionNumber, Instant validFrom, UUID createdBy,
                           List<NewTier> tiers) {}
    record NewTier(UUID presentationId, BigDecimal minimumBaseUnits, BigDecimal maximumBaseUnits,
                   BigDecimal unitPrice) {}
    record PriceListView(UUID id, String code, String name, String status, String currencyCode,
                         List<PriceVersionView> versions) {}
    record PriceVersionView(UUID id, int versionNumber, Instant validFrom, Instant validTo, String status,
                            List<TierView> tiers) {}
    record TierView(UUID id, UUID presentationId, String presentationCode, String presentationName,
                    BigDecimal minimumBaseUnits, BigDecimal maximumBaseUnits, BigDecimal unitPrice) {}
    record NewSpecialPrice(UUID customerId, UUID presentationId, BigDecimal unitPrice, Instant validFrom,
                           Instant validTo, UUID approvedBy) {}
    record SpecialPriceView(UUID id, UUID customerId, String customerCode, String customerName,
                            UUID presentationId, String presentationCode, String presentationName,
                            BigDecimal unitPrice, Instant validFrom, Instant validTo, String status) {}
    record NewDiscount(UUID requestedBy, UUID customerId, UUID presentationId, BigDecimal normalPrice,
                       BigDecimal requestedPrice, String reason, Instant expiresAt) {}
    record DiscountView(UUID id, UUID requestedBy, String requesterUsername, UUID approvedBy,
                        UUID customerId, String customerName, UUID presentationId, String presentationName,
                        BigDecimal normalPrice, BigDecimal requestedPrice, String reason, String status,
                        Instant expiresAt, Instant decidedAt, Instant createdAt) {}
}
