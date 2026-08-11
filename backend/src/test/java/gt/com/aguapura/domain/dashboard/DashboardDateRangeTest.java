package gt.com.aguapura.domain.dashboard;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class DashboardDateRangeTest {
    @Test
    void usesTheConfiguredCompanyTimezoneForTheOperationalDay() {
        var range = DashboardDateRange.today(
                Instant.parse("2026-08-11T03:30:00Z"),
                ZoneId.of("America/Guatemala"));

        assertThat(range.startInclusive()).isEqualTo(Instant.parse("2026-08-10T06:00:00Z"));
        assertThat(range.endExclusive()).isEqualTo(Instant.parse("2026-08-11T06:00:00Z"));
    }
}
