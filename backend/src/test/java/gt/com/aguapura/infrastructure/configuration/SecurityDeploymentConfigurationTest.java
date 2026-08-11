package gt.com.aguapura.infrastructure.configuration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityDeploymentConfigurationTest {

    @Test
    void runtimeConfigurationHasNoKnownSecretFallbacksAndBindsInternalPortsToLoopback() throws Exception {
        String application = Files.readString(Path.of("src/main/resources/application.yml"));
        String compose = Files.readString(Path.of("../docker-compose.yml"));
        String production = Files.readString(Path.of("../docker-compose.prod.yml"));
        String productionApplication = Files.readString(Path.of("src/main/resources/application-prod.yml"));
        String nginx = Files.readString(Path.of("../frontend/nginx.conf"));

        assertThat(application).doesNotContain("change-this-database-password")
                .doesNotContain("Y2hhbmdlLXRoaXMtZGV2ZWxvcG1lbnQtc2VjcmV0LWtleS0xMjM0NTY3ODkw");
        assertThat(compose).contains("${POSTGRES_PASSWORD:?")
                .contains("${JWT_SECRET_BASE64:?")
                .doesNotContain("${POSTGRES_PORT:-5432}:5432")
                .doesNotContain("${BACKEND_PORT:-8080}:8080");
        assertThat(production).contains("SPRING_PROFILES_ACTIVE: prod")
                .contains("COOKIE_SECURE: \"true\"")
                .contains("nginx.prod.conf")
                .contains("${HTTPS_PORT:-8443}:8443");
        assertThat(productionApplication).contains("cookie-secure: true")
                .contains("api-docs:\n    enabled: false");
        assertThat(nginx).contains("limit_req_zone")
                .contains("client_max_body_size")
                .contains("include /etc/nginx/security-headers.conf;")
                .contains("proxy_set_header X-Forwarded-For $remote_addr;");
    }
}
