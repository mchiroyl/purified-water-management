package gt.com.aguapura.application.dto.route;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record AssignCustomerRouteRequest(@NotNull UUID routeId, @NotNull LocalDate validFrom) {}
