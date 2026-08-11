package gt.com.aguapura.infrastructure.database.adapters;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class JdbcReturnAdapterTest {
    @Test
    void convertsClientInstantToPostgresqlTimestampWithTimezone() {
        Instant clientTime = Instant.parse("2026-08-11T06:46:19.087216Z");

        assertThat(JdbcReturnAdapter.databaseTimestamp(clientTime))
                .isEqualTo(clientTime.atOffset(ZoneOffset.UTC));
    }
}
