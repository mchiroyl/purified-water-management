package gt.com.aguapura.domain.pricing;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PricePolicyTest {
    @Test
    void selectsWholesaleTierUsingBaseUnitQuantity() {
        UUID versionId = UUID.randomUUID();
        var tiers = List.of(
                tier(versionId, "1", "5", "12.00"),
                tier(versionId, "6", "10", "11.00"),
                tier(versionId, "11", null, "9.00"));

        var decision = PricePolicy.resolve(new BigDecimal("6"), Optional.empty(), tiers);

        assertThat(decision.unitPrice()).isEqualByComparingTo("11.00");
        assertThat(decision.source()).isEqualTo("PRICE_TIER");
        assertThat(decision.priceVersionId()).isEqualTo(versionId);
    }

    @Test
    void customerSpecialPriceHasPriorityOverGeneralTier() {
        UUID specialId = UUID.randomUUID();
        var special = new PricePolicy.SpecialPrice(specialId, new BigDecimal("8.50"));

        var decision = PricePolicy.resolve(BigDecimal.ONE, Optional.of(special),
                List.of(tier(UUID.randomUUID(), "1", null, "12.00")));

        assertThat(decision.unitPrice()).isEqualByComparingTo("8.50");
        assertThat(decision.source()).isEqualTo("CUSTOMER_SPECIAL_PRICE");
        assertThat(decision.specialPriceId()).isEqualTo(specialId);
    }

    @Test
    void rejectsQuantityWithoutApplicableServerRule() {
        assertThatThrownBy(() -> PricePolicy.resolve(new BigDecimal("20"), Optional.empty(),
                List.of(tier(UUID.randomUUID(), "1", "5", "12.00"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No existe una regla de precio aplicable.");
    }

    private PricePolicy.Tier tier(UUID versionId, String min, String max, String price) {
        return new PricePolicy.Tier(UUID.randomUUID(), versionId, new BigDecimal(min),
                max == null ? null : new BigDecimal(max), new BigDecimal(price));
    }
}
