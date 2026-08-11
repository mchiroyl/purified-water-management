package gt.com.aguapura.application.dto.waste;

import java.math.BigDecimal;
import java.util.UUID;

public record WasteIndicatorResponse(UUID sellerId, String sellerName, UUID routeId, String routeName,
                                     UUID productId, String productName, long reportCount,
                                     BigDecimal reportedBaseUnits, BigDecimal approvedBaseUnits,
                                     long openAlerts) {
}
