package gt.com.aguapura.infrastructure.database.adapters;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class JdbcSyncOperationAdapterTest {
    @Test
    void convertsClientInstantToAnExplicitPostgresqlTimestampType() {
        Instant clientTime = Instant.parse("2026-08-10T20:00:00Z");

        OffsetDateTime databaseTime = JdbcSyncOperationAdapter.databaseTimestamp(clientTime);

        assertThat(databaseTime).isEqualTo(clientTime.atOffset(ZoneOffset.UTC));
    }
}
