package gt.com.aguapura.infrastructure.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TokenHashingServiceTest {

    private final TokenHashingService service = new TokenHashingService();

    @Test
    void generatesUnpredictableOpaqueTokens() {
        String first = service.newOpaqueToken();
        String second = service.newOpaqueToken();

        assertThat(first).hasSizeGreaterThanOrEqualTo(64).isNotEqualTo(second);
        assertThat(first).doesNotContain("=");
    }

    @Test
    void hashesTokensDeterministicallyWithoutKeepingRawValue() {
        String raw = "a-sensitive-refresh-token";

        assertThat(service.sha256(raw))
                .hasSize(64)
                .isEqualTo(service.sha256(raw))
                .doesNotContain(raw);
    }
}
