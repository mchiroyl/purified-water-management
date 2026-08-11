package gt.com.aguapura.presentation.advice;

import org.junit.jupiter.api.Test;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    @Test
    void malformedJsonReturnsBadRequestWithStableErrorCode() {
        var request = new MockHttpServletRequest();
        request.setAttribute(CorrelationIdFilter.ATTRIBUTE, "correlation-test");
        var exception = new HttpMessageNotReadableException(
                "JSON malformado",
                new MockHttpInputMessage(new byte[0])
        );

        var response = new GlobalExceptionHandler().malformedJson(exception, request);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("MALFORMED_JSON");
        assertThat(response.getBody().correlationId()).isEqualTo("correlation-test");
    }

    @Test
    void accessDeniedReturnsForbiddenInsteadOfInternalError() {
        var request = new MockHttpServletRequest();
        request.setAttribute(CorrelationIdFilter.ATTRIBUTE, "forbidden-test");

        var response = new GlobalExceptionHandler().accessDenied(
                new AccessDeniedException("Access denied"), request);

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("ACCESS_DENIED");
    }
}
