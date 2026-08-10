package gt.com.aguapura.presentation.advice;

import java.time.Instant;
import java.util.List;

public record ApiErrorResponse(
        String code,
        String message,
        String correlationId,
        Instant timestamp,
        List<FieldErrorResponse> fieldErrors
) {
    public record FieldErrorResponse(String field, String message) {
    }
}
