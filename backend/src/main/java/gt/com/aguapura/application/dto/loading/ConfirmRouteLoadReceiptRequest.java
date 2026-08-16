package gt.com.aguapura.application.dto.loading;

import gt.com.aguapura.application.dto.location.GeoLocationRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ConfirmRouteLoadReceiptRequest(@NotNull @Valid GeoLocationRequest location) {
}
