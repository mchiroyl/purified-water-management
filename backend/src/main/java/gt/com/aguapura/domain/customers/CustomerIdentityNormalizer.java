package gt.com.aguapura.domain.customers;

import java.text.Normalizer;
import java.util.Locale;

public final class CustomerIdentityNormalizer {
    private CustomerIdentityNormalizer() {
    }

    public static String name(String value) {
        return Normalizer.normalize(safe(value).toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\s+", " ").trim();
    }

    public static String phone(String value) {
        return safe(value).replaceAll("\\D", "");
    }

    public static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
