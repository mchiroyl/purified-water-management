package gt.com.aguapura.application.dto.annulment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DecideAnnulmentRequest(@NotBlank @Pattern(regexp = "APPROVE|REJECT") String decision,
                                     @NotBlank @Size(max = 500) String notes) {}
