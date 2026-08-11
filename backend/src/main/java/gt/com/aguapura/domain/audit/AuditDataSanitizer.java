package gt.com.aguapura.domain.audit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class AuditDataSanitizer {
    private static final Set<String> FORBIDDEN = Set.of(
            "password", "token", "secret", "credential", "authorization", "cookie", "privatekey", "apikey");

    private AuditDataSanitizer() {
    }

    public static Map<String, Object> sanitize(Map<String, ?> source) {
        if (source == null || source.isEmpty()) return Map.of();
        var result = new LinkedHashMap<String, Object>();
        source.forEach((key, value) -> {
            String normalized = key.replaceAll("[^A-Za-z]", "").toLowerCase(Locale.ROOT);
            if (FORBIDDEN.stream().noneMatch(normalized::contains)) result.put(key, sanitizeValue(value));
        });
        return Map.copyOf(result);
    }

    private static Object sanitizeValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            var typed = new LinkedHashMap<String, Object>();
            map.forEach((key, nested) -> typed.put(String.valueOf(key), nested));
            return sanitize(typed);
        }
        if (value instanceof Iterable<?> iterable) {
            var result = new ArrayList<>();
            iterable.forEach(item -> result.add(sanitizeValue(item)));
            return List.copyOf(result);
        }
        return value;
    }
}
