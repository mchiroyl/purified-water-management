package gt.com.aguapura.infrastructure.security;

import gt.com.aguapura.infrastructure.configuration.SecurityProperties;
import gt.com.aguapura.infrastructure.database.entities.UserJpaEntity;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
public class JwtTokenService {

    private final JwtEncoder encoder;
    private final SecurityProperties properties;

    public JwtTokenService(JwtEncoder encoder, SecurityProperties properties) {
        this.encoder = encoder;
        this.properties = properties;
    }

    public IssuedAccessToken issue(UserJpaEntity user, UUID deviceId) {
        var now = Instant.now();
        var expiresAt = now.plus(properties.accessTokenDuration());
        var roles = user.getRoles().stream().map(role -> role.getCode()).sorted().toList();
        var claims = JwtClaimsSet.builder()
                .issuer(properties.issuer())
                .issuedAt(now)
                .notBefore(now)
                .expiresAt(expiresAt)
                .subject(user.getUsername())
                .id(UUID.randomUUID().toString())
                .claim("userId", user.getId().toString())
                .claim("deviceId", deviceId.toString())
                .claim("roles", roles)
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        var token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedAccessToken(token, expiresAt);
    }

    public record IssuedAccessToken(String value, Instant expiresAt) {
    }
}
