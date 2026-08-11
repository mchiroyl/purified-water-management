package gt.com.aguapura.domain.reports;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReportDateRangeTest {
    private final Clock clock = Clock.fixed(Instant.parse("2026-08-11T10:00:00Z"), ZoneId.of("UTC"));

    @Test
    void convertsInclusiveLocalDatesWithTheCompanyTimezone() {
        var range = ReportDateRange.of(LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-10"),
                ZoneId.of("America/Guatemala"), clock);

        assertThat(range.startInclusive()).isEqualTo(Instant.parse("2026-08-01T06:00:00Z"));
        assertThat(range.endExclusive()).isEqualTo(Instant.parse("2026-08-11T06:00:00Z"));
    }

    @Test
    void rejectsRangesLongerThanOneYear() {
        assertThatThrownBy(() -> ReportDateRange.of(LocalDate.parse("2025-01-01"),
                LocalDate.parse("2026-08-10"), ZoneId.of("America/Guatemala"), clock))
                .isInstanceOf(BusinessException.class);
    }
}
