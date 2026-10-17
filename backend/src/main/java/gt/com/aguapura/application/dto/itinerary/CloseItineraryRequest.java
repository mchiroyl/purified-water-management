package gt.com.aguapura.application.dto.itinerary;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CloseItineraryRequest(
        @NotBlank @Size(max = 300) String reason
) {}
