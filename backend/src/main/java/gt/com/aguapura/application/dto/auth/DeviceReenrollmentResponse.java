package gt.com.aguapura.application.dto.auth;
import java.time.Instant; import java.util.UUID;
public record DeviceReenrollmentResponse(UUID id, String username, String token, String status,
                                         String deviceName, Instant expiresAt, Instant createdAt, UUID deviceId) {}
