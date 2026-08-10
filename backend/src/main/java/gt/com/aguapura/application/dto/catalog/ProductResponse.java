package gt.com.aguapura.application.dto.catalog;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String code,
        String name,
        String description,
        String baseUnitCode,
        boolean active,
        boolean controlsInventory,
        List<PresentationResponse> presentations
) {
    public record PresentationResponse(
            UUID id,
            String code,
            String name,
            String unitCode,
            BigDecimal conversionFactor,
            boolean active
    ) {
    }
}
