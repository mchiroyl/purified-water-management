package gt.com.aguapura.application.dto.waste;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ReviewWasteRequest(
        @NotBlank @Pattern(regexp = "APPROVE|REJECT") String decision,
        @NotEmpty @Valid List<ItemApproval> items,
        @NotBlank @Size(max = 500) String notes) {
    public record ItemApproval(@NotNull UUID itemId,
                               @NotNull @DecimalMin(value = "0") BigDecimal approvedBaseUnits) {
    }
}
