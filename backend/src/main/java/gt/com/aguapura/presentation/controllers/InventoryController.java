package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.inventory.CreateInventoryLocationRequest;
import gt.com.aguapura.application.dto.inventory.InventoryAdjustmentRequest;
import gt.com.aguapura.application.dto.inventory.InventoryLocationResponse;
import gt.com.aguapura.application.dto.inventory.InventoryMovementResponse;
import gt.com.aguapura.application.services.InventoryApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
    private final InventoryApplicationService service;

    public InventoryController(InventoryApplicationService service) {
        this.service = service;
    }

    @GetMapping("/locations")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<InventoryLocationResponse> findLocations(@AuthenticationPrincipal Jwt jwt) {
        return service.findLocations(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping("/locations")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public InventoryLocationResponse createLocation(@Valid @RequestBody CreateInventoryLocationRequest request) {
        return service.createLocation(request);
    }

    @PostMapping("/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public InventoryMovementResponse adjust(@Valid @RequestBody InventoryAdjustmentRequest request,
                                            @AuthenticationPrincipal Jwt jwt) {
        return service.adjust(request, actor(jwt), UUID.fromString(jwt.getClaimAsString("deviceId")));
    }

    @GetMapping("/locations/{id}/movements")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<InventoryMovementResponse> findMovements(@PathVariable UUID id,
                                                        @AuthenticationPrincipal Jwt jwt) {
        return service.findMovements(id, actor(jwt), sellerOnly(jwt));
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getClaimAsString("userId"));
    }

    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
    }
}
