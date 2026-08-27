package gt.com.aguapura.application.dto.identity;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateDeviceEnrollmentRequest(@NotNull UUID userId) {}
