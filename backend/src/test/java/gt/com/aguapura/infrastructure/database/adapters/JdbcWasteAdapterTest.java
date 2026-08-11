package gt.com.aguapura.infrastructure.database.adapters;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class JdbcWasteAdapterTest {
    @Test
    void convertsClientInstantToPostgresqlTimestampWithTimezone() {
        Instant clientTime = Instant.parse("2026-08-11T06:46:19.087216Z");

        OffsetDateTime databaseTime = JdbcWasteAdapter.databaseTimestamp(clientTime);

        assertThat(databaseTime).isEqualTo(clientTime.atOffset(ZoneOffset.UTC));
    }
}
