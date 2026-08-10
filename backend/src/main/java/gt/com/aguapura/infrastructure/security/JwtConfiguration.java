package gt.com.aguapura.infrastructure.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import gt.com.aguapura.infrastructure.configuration.SecurityProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.util.Map;

@Configuration
public class JwtConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        var argon2 = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
        return new DelegatingPasswordEncoder("argon2", Map.of("argon2", argon2));
    }

    @Bean
    SecretKey jwtSecretKey(SecurityProperties properties) {
        byte[] decoded = Base64.getDecoder().decode(properties.secretBase64());
        if (decoded.length < 32) {
            throw new IllegalStateException("JWT_SECRET_BASE64 debe contener al menos 32 bytes");
        }
        return new SecretKeySpec(decoded, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey secretKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(secretKey));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey secretKey, SecurityProperties properties) {
        var decoder = NimbusJwtDecoder.withSecretKey(secretKey).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.issuer()));
        return decoder;
    }
}
