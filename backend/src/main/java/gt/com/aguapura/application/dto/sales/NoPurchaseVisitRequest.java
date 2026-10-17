package gt.com.aguapura.application.dto.sales;

import gt.com.aguapura.application.dto.location.GeoLocationRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record NoPurchaseVisitRequest(
        @NotNull UUID routeId,
        @NotNull UUID customerId,
        @NotNull @Pattern(regexp = "NO_ESTABA|NO_NECESITABA|OTRO")
        String visitReason,
        @Size(max = 300) String visitNote,
        @NotNull @Valid GeoLocationRequest location
) {}
