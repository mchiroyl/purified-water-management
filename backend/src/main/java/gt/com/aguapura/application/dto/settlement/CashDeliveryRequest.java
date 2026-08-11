package gt.com.aguapura.application.dto.settlement;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CashDeliveryRequest(@NotNull @DecimalMin("0.01") BigDecimal amount,
                                  @NotBlank @Size(max = 500) String notes) {
}
