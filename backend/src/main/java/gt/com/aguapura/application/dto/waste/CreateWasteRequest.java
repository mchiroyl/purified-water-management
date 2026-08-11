package gt.com.aguapura.application.dto.waste;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CreateWasteRequest(
        @NotNull UUID clientReference,
        @NotNull UUID routeId,
        @NotBlank @Size(max = 500) String reason,
        @NotNull Instant occurredAtLocal,
        @NotEmpty @Valid List<Item> items,
        @NotNull @Valid List<Evidence> evidence) {

    public record Item(
            @NotNull UUID wasteTypeId,
            @NotNull UUID presentationId,
            @NotNull @DecimalMin(value = "0.0001") BigDecimal presentationQuantity,
            @NotNull @DecimalMin(value = "0.0001") BigDecimal reportedDamagedUnits,
            @NotNull @DecimalMin(value = "0") BigDecimal recoverableUnits) {
    }

    public record Evidence(
            @NotBlank @Size(max = 500) String storageReference,
            @NotBlank @Pattern(regexp = "image/(jpeg|png|webp)") String mediaType,
            @NotBlank @Pattern(regexp = "[a-fA-F0-9]{64}") String sha256,
            @NotNull Instant capturedAtLocal) {
    }
}
