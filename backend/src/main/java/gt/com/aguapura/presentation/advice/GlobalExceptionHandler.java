package gt.com.aguapura.presentation.advice;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> business(BusinessException exception, HttpServletRequest request) {
        return response(statusOf(exception.category()), exception.code(), exception.getMessage(), request, null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        var fields = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new ApiErrorResponse.FieldErrorResponse(error.getField(), error.getDefaultMessage()))
                .toList();
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "La solicitud contiene datos inválidos.", request, fields);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> malformedJson(HttpMessageNotReadableException exception,
                                                           HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "MALFORMED_JSON", "El cuerpo JSON no es válido.", request, null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> integrity(DataIntegrityViolationException exception, HttpServletRequest request) {
        String causeMsg = exception.getMostSpecificCause().getMessage();
        log.warn("Violación de integridad. correlationId={}, cause={}",
                correlation(request), causeMsg, exception);
        if (causeMsg != null && causeMsg.contains("uq_route_load_open_initial_route")) {
            return response(HttpStatus.CONFLICT, "DATA_CONFLICT",
                    "Esta ruta ya cuenta con una carga inicial activa y no liquidada (en preparación, confirmada o en recorrido). No se pueden registrar dos cargas iniciales simultáneas para la misma ruta sin antes liquidar o finalizar la anterior.",
                    request, null);
        }
        if (causeMsg != null && causeMsg.contains("daily_itinerary_run_route_load_id_key")) {
            return response(HttpStatus.CONFLICT, "DATA_CONFLICT",
                    "Esta carga ya tiene su lista de clientes y recorrido enviado al vendedor previamente.",
                    request, null);
        }
        return response(HttpStatus.CONFLICT, "DATA_CONFLICT", "La operación entra en conflicto con datos existentes.", request, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> accessDenied(AccessDeniedException exception,
                                                          HttpServletRequest request) {
        return response(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "No tiene permiso para realizar esta operación.",
                request, null);
    }

    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> methodNotSupported(org.springframework.web.HttpRequestMethodNotSupportedException exception,
                                                               HttpServletRequest request) {
        return response(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED",
                "El método HTTP " + exception.getMethod() + " no está permitido para esta ruta.", request, null);
    }

    @ExceptionHandler(org.springframework.dao.DataAccessResourceFailureException.class)
    public ResponseEntity<ApiErrorResponse> resourceFailure(org.springframework.dao.DataAccessResourceFailureException exception,
                                                            HttpServletRequest request) {
        log.error("Fallo de conexión o agotamiento de pool de base de datos. correlationId={}, cause={}", correlation(request), exception.getMessage());
        return response(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE",
                "El servicio no se encuentra disponible temporalmente debido a alta carga. Intente nuevamente en unos momentos.",
                request, null);
    }

    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<ApiErrorResponse> database(org.springframework.dao.DataAccessException exception,
                                                     HttpServletRequest request) {
        log.warn("Error en base de datos. correlationId={}, cause={}", correlation(request), exception.getMessage());
        return response(HttpStatus.CONFLICT, "DATABASE_ERROR", "Error al procesar la operación en base de datos.", request, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> unexpected(Exception exception, HttpServletRequest request) {
        log.error("Error no controlado. correlationId={}", correlation(request), exception);
        String msg = exception.getMessage() != null && !exception.getMessage().isBlank() ? exception.getMessage() : "Ocurrió un error interno.";
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", msg, request, null);
    }

    private ResponseEntity<ApiErrorResponse> response(HttpStatus status, String code, String message,
                                                       HttpServletRequest request,
                                                       java.util.List<ApiErrorResponse.FieldErrorResponse> fields) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(code, message, correlation(request), Instant.now(), fields));
    }

    private String correlation(HttpServletRequest request) {
        Object value = request.getAttribute(CorrelationIdFilter.ATTRIBUTE);
        return value == null ? "unknown" : value.toString();
    }

    private HttpStatus statusOf(ErrorCategory category) {
        return switch (category) {
            case VALIDATION -> HttpStatus.BAD_REQUEST;
            case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT -> HttpStatus.CONFLICT;
            case RATE_LIMIT -> HttpStatus.TOO_MANY_REQUESTS;
            case INTERNAL -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}
