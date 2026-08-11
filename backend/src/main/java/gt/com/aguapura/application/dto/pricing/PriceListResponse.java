package gt.com.aguapura.application.dto.pricing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PriceListResponse(UUID id, String code, String name, String status, String currencyCode,
                                List<VersionResponse> versions) {
    public record VersionResponse(UUID id, int versionNumber, Instant validFrom, Instant validTo,
                                  String status, List<TierResponse> tiers) {}
    public record TierResponse(UUID id, UUID presentationId, String presentationCode, String presentationName,
                               BigDecimal minimumBaseUnits, BigDecimal maximumBaseUnits, BigDecimal unitPrice) {}
}
