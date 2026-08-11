package gt.com.aguapura.domain.audit;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditDataSanitizerTest {
    @Test
    void recursivelyRemovesSecretsAndKeepsAllowedBusinessData() {
        var sanitized = AuditDataSanitizer.sanitize(Map.of(
                "status", "ACTIVE",
                "password", "never-store",
                "nested", Map.of("accessToken", "secret", "roles", List.of("VENDEDOR")),
                "credentialSecretRef", "vault://secret"));

        assertThat(sanitized).containsEntry("status", "ACTIVE");
        assertThat(sanitized).doesNotContainKeys("password", "credentialSecretRef");
        var nested = (Map<?, ?>) sanitized.get("nested");
        assertThat(nested.containsKey("roles")).isTrue();
        assertThat(nested.containsKey("accessToken")).isFalse();
    }
}
