package gt.com.aguapura.application.ports;

import java.time.Instant;
import java.util.UUID;

public interface AccessTokenIssuer {
    IssuedAccessToken issue(AuthenticationPersistencePort.AuthUser user, UUID deviceId);
    record IssuedAccessToken(String value, Instant expiresAt) { }
}
