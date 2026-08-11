package gt.com.aguapura.infrastructure.security;

import gt.com.aguapura.application.ports.AccessPrincipalStatePort;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class ActivePrincipalJwtValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error INVALID_PRINCIPAL = new OAuth2Error(
            "invalid_token", "El usuario o dispositivo ya no esta autorizado.", null);

    private final AccessPrincipalStatePort state;

    public ActivePrincipalJwtValidator(AccessPrincipalStatePort state) {
        this.state = state;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        try {
            UUID userId = UUID.fromString(token.getClaimAsString("userId"));
            UUID deviceId = UUID.fromString(token.getClaimAsString("deviceId"));
            List<String> claimedRoles = token.getClaimAsStringList("roles");
            Set<String> roles = claimedRoles == null ? Set.of() : new LinkedHashSet<>(claimedRoles);
            return state.matchesActivePrincipal(userId, deviceId, roles)
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(INVALID_PRINCIPAL);
        } catch (RuntimeException exception) {
            return OAuth2TokenValidatorResult.failure(INVALID_PRINCIPAL);
        }
    }
}
