package gt.com.aguapura.application.dto.identity;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record UserAdministrationResponse(
        UUID id, String username, String email, String status, boolean mustChangePassword,
        Set<String> roles, UUID sellerId, String sellerCode, String sellerDisplayName, Instant createdAt
) {}
