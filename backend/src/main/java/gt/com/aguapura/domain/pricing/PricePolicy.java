package gt.com.aguapura.domain.pricing;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public final class PricePolicy {
    private PricePolicy() {}

    public static Decision resolve(BigDecimal quantityBaseUnits, Optional<SpecialPrice> specialPrice,
                                   List<Tier> tiers) {
        if (quantityBaseUnits == null || quantityBaseUnits.signum() <= 0) {
            throw new IllegalArgumentException("La cantidad debe ser mayor que cero.");
        }
        if (specialPrice.isPresent()) {
            var special = specialPrice.get();
            return new Decision(special.unitPrice(), "CUSTOMER_SPECIAL_PRICE", null, null, special.id());
        }
        return tiers.stream()
                .filter(tier -> quantityBaseUnits.compareTo(tier.minimumBaseUnits()) >= 0)
                .filter(tier -> tier.maximumBaseUnits() == null
                        || quantityBaseUnits.compareTo(tier.maximumBaseUnits()) <= 0)
                .max(java.util.Comparator.comparing(Tier::minimumBaseUnits))
                .map(tier -> new Decision(tier.unitPrice(), "PRICE_TIER", tier.priceVersionId(), tier.id(), null))
                .orElseThrow(() -> new IllegalArgumentException("No existe una regla de precio aplicable."));
    }

    public record Tier(UUID id, UUID priceVersionId, BigDecimal minimumBaseUnits,
                       BigDecimal maximumBaseUnits, BigDecimal unitPrice) {}
    public record SpecialPrice(UUID id, BigDecimal unitPrice) {}
    public record Decision(BigDecimal unitPrice, String source, UUID priceVersionId,
                           UUID priceTierId, UUID specialPriceId) {}
}
