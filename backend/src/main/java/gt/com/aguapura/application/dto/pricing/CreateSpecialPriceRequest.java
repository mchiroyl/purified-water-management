package gt.com.aguapura.application.dto.pricing;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CreateSpecialPriceRequest(@NotNull UUID customerId, @NotNull UUID presentationId,
                                        @NotNull @DecimalMin("0.01") BigDecimal unitPrice,
                                        @NotNull Instant validFrom, Instant validTo) {}
