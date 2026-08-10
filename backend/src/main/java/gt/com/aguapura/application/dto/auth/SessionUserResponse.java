package gt.com.aguapura.application.dto.auth;

import java.util.Set;
import java.util.UUID;

public record SessionUserResponse(
        UUID id,
        String username,
        String displayName,
        Set<String> roles,
        boolean mustChangePassword
) {
}
