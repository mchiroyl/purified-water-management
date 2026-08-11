package gt.com.aguapura.application.dto.pricing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SpecialPriceResponse(UUID id, UUID customerId, String customerCode, String customerName,
                                   UUID presentationId, String presentationCode, String presentationName,
                                   BigDecimal unitPrice, Instant validFrom, Instant validTo, String status) {}
