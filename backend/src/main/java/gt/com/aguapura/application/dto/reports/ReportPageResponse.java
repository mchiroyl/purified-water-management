package gt.com.aguapura.application.dto.reports;

import java.util.List;

public record ReportPageResponse<T>(List<T> content, long totalElements, int page, int size, boolean hasNext) {
}
