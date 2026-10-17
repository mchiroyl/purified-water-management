package gt.com.aguapura.application.dto.itinerary;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record PublishDailyItineraryRequest(
        @NotNull UUID routeLoadId,
        UUID templateId
) {}
