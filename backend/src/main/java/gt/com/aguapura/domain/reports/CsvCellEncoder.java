package gt.com.aguapura.domain.reports;

public final class CsvCellEncoder {
    private CsvCellEncoder() {
    }

    public static String encode(Object raw) {
        String value = raw == null ? "" : String.valueOf(raw);
        String stripped = value.stripLeading();
        if (!stripped.isEmpty() && "=+-@".indexOf(stripped.charAt(0)) >= 0) value = "'" + value;
        boolean quote = value.indexOf(',') >= 0 || value.indexOf('"') >= 0
                || value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0 || value.startsWith("'");
        return quote ? "\"" + value.replace("\"", "\"\"") + "\"" : value;
    }
}
