package gt.com.aguapura.application.dto.catalog;

import java.math.BigDecimal;
import java.util.UUID;

public record PresentationTemplateResponse(UUID id, String code, String name, String presentationType,
                                           BigDecimal contentQuantity, String contentUnit, String unitCode,
                                           BigDecimal conversionFactor, boolean active) { }
