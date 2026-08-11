package gt.com.aguapura.application.dto.pricing;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CreateDiscountRequest(@NotNull UUID customerId, @NotNull UUID presentationId,
                                    @NotNull @DecimalMin("0.0001") BigDecimal quantityBaseUnits,
                                    @NotNull @DecimalMin("0.01") BigDecimal requestedPrice,
                                    @NotBlank @Size(min = 5, max = 1000) String reason,
                                    @NotNull Instant expiresAt) {}
