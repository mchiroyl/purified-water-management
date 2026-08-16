package gt.com.aguapura.application.dto.location;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertTrue;

class GeoLocationRequestTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsNormalPoint() {
        var request = new GeoLocationRequest(new BigDecimal("14.6349"), new BigDecimal("-90.5069"),
                new BigDecimal("5.5"), Instant.parse("2026-08-16T12:00:00Z"));

        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void rejectsLatitudeAboveNinety() {
        var request = new GeoLocationRequest(new BigDecimal("91"), BigDecimal.ZERO, null, Instant.now());

        assertTrue(paths(request).contains("latitude"));
    }

    @Test
    void rejectsLongitudeBelowMinusOneEighty() {
        var request = new GeoLocationRequest(BigDecimal.ZERO, new BigDecimal("-181"), null, Instant.now());

        assertTrue(paths(request).contains("longitude"));
    }

    @Test
    void rejectsNegativeAccuracy() {
        var request = new GeoLocationRequest(BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("-0.01"), Instant.now());

        assertTrue(paths(request).contains("accuracyMeters"));
    }

    private Set<String> paths(GeoLocationRequest request) {
        return validator.validate(request).stream().map(error -> error.getPropertyPath().toString())
                .collect(Collectors.toSet());
    }
}
