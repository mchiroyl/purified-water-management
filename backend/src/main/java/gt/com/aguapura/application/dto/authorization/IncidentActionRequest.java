package gt.com.aguapura.application.dto.authorization;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record IncidentActionRequest(@NotBlank @Pattern(regexp = "INVESTIGATE|RESOLVE|DISMISS") String action,
                                    @Size(max = 1000) String notes) {
}
