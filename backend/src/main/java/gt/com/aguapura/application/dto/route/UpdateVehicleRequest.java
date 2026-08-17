package gt.com.aguapura.application.dto.route;

import jakarta.validation.constraints.Size;

public record UpdateVehicleRequest(@Size(max = 20) String licensePlate, @Size(max = 200) String description) {}
