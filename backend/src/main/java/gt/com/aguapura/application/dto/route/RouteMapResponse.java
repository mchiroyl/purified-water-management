package gt.com.aguapura.application.dto.route;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record RouteMapResponse(
        String sellerName,
        String routeName,
        java.time.LocalDate date,
        int salesCount,
        int noPurchaseVisitCount,
        BigDecimal totalAmount,
        long durationMinutes,
        List<Point> points
) {
    public record Point(
            String pointType,
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal accuracyMeters,
            Instant capturedAt,
            String documentNumber,
            BigDecimal saleTotal,
            String customerName,
            String visitNote
    ) {}
}
