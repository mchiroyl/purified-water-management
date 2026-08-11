package gt.com.aguapura.application.dto.returns;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ConfirmReturnReceiptRequest(
        @NotNull UUID warehouseLocationId,
        @NotEmpty @Size(max = 100) @Valid List<ItemReceipt> items,
        @NotBlank @Size(max = 500) String notes) {
    public record ItemReceipt(@NotNull UUID itemId,
                              @NotNull @DecimalMin("0") BigDecimal receivedBaseUnits) {
    }
}
