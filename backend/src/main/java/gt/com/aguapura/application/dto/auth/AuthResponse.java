package gt.com.aguapura.application.dto.auth;

import java.time.Instant;

public record AuthResponse(
        String accessToken,
        Instant accessTokenExpiresAt,
        SessionUserResponse user
) {
}
