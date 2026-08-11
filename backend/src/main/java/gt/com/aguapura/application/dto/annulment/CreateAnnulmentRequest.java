package gt.com.aguapura.application.dto.annulment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateAnnulmentRequest(@NotNull UUID saleId, @NotBlank @Size(max = 500) String reason) {}
