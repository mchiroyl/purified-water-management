package gt.com.aguapura.application.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank
        @Size(min = 3, max = 80)
        @Pattern(regexp = "[a-zA-Z0-9._@-]+")
        String username,

        @NotBlank
        @Size(min = 12, max = 200)
        String password,

        @NotBlank
        @Size(min = 2, max = 100)
        String deviceName,

        @Size(max = 40)
        String appVersion
) {
}
