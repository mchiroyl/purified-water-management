package gt.com.aguapura.application.dto.route;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record RouteResponse(
        UUID id, String code, String name, String description, String status,
        UUID sellerId, String sellerCode, String sellerName, UUID vehicleId, String vehicleCode,
        String licensePlate, long customerCount, LocalDate assignmentValidFrom, Instant createdAt
) {}
