package gt.com.aguapura.application.dto.loading;

import gt.com.aguapura.application.dto.location.GeoLocationRequest;
import jakarta.validation.Valid;

public record ConfirmRouteLoadReceiptRequest(@Valid GeoLocationRequest location) {
}
