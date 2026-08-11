package gt.com.aguapura.domain.dashboard;

import java.time.Instant;
import java.time.ZoneId;

public record DashboardDateRange(Instant startInclusive, Instant endExclusive) {
    public static DashboardDateRange today(Instant now, ZoneId timezone) {
        var localDate = now.atZone(timezone).toLocalDate();
        return new DashboardDateRange(
                localDate.atStartOfDay(timezone).toInstant(),
                localDate.plusDays(1).atStartOfDay(timezone).toInstant());
    }
}
