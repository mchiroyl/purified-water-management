package gt.com.aguapura.application.dto.itinerary;

public record AutoConfirmSummary(
        int autoConfirmed,
        int alreadyHadLocation,
        int noHistoricalData
) {}
