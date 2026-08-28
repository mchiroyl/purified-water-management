package gt.com.aguapura.application.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeviceEnrollmentRequest(
        @Size(max = 200) String token,
        @NotBlank @Size(min = 2, max = 100) String deviceName,
        @Size(max = 40) String appVersion
) {}
