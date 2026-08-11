package gt.com.aguapura.domain.reports;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

public record ReportDateRange(Instant startInclusive, Instant endExclusive) {
    public static ReportDateRange of(LocalDate from, LocalDate to, ZoneId timezone, Clock clock) {
        LocalDate defaultDate = clock.instant().atZone(timezone).toLocalDate();
        LocalDate actualFrom = from == null ? defaultDate : from;
        LocalDate actualTo = to == null ? actualFrom : to;
        long days = ChronoUnit.DAYS.between(actualFrom, actualTo);
        if (days < 0 || days > 365) {
            throw new BusinessException("INVALID_REPORT_RANGE",
                    "El rango debe estar ordenado y no superar 366 días.", ErrorCategory.VALIDATION);
        }
        return new ReportDateRange(actualFrom.atStartOfDay(timezone).toInstant(),
                actualTo.plusDays(1).atStartOfDay(timezone).toInstant());
    }
}
