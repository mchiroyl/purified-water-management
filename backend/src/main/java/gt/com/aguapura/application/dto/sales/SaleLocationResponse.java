package gt.com.aguapura.application.dto.sales;

import java.math.BigDecimal;
import java.time.Instant;

public record SaleLocationResponse(
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal accuracyMeters,
        Instant capturedAt,
        Instant persistedAt
) {}
