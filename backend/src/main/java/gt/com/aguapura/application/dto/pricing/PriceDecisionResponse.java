package gt.com.aguapura.application.dto.pricing;

import java.math.BigDecimal;
import java.util.UUID;

public record PriceDecisionResponse(BigDecimal unitPrice, String source, UUID priceVersionId,
                                    UUID priceTierId, UUID specialPriceId) {}
