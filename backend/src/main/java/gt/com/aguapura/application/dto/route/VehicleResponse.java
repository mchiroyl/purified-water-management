package gt.com.aguapura.application.dto.route;

import java.time.Instant;
import java.util.UUID;

public record VehicleResponse(UUID id, String code, String licensePlate, String description, String status, Instant createdAt) {}
