package gt.com.aguapura.application.dto.auth;
import jakarta.validation.constraints.*;
public record DeviceReenrollmentRequest(
        @NotBlank @Size(min=3,max=80) String username,
        @NotBlank @Size(min=12,max=200) String password,
        @NotBlank @Size(min=2,max=100) String deviceName){}
