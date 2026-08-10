package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.identity.CreateUserRequest;
import gt.com.aguapura.application.dto.identity.DeviceAdministrationResponse;
import gt.com.aguapura.application.dto.identity.UserAdministrationResponse;
import gt.com.aguapura.application.services.IdentityAdministrationApplicationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/administration")
@PreAuthorize("hasRole('ADMINISTRADOR')")
@Validated
public class IdentityAdministrationController {

    private final IdentityAdministrationApplicationService service;

    public IdentityAdministrationController(IdentityAdministrationApplicationService service) {
        this.service = service;
    }

    @GetMapping("/users")
    public List<UserAdministrationResponse> findUsers() { return service.findUsers(); }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public UserAdministrationResponse createUser(@Valid @RequestBody CreateUserRequest request) {
        return service.createUser(request);
    }

    @PatchMapping("/users/{id}/status")
    public UserAdministrationResponse changeStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest request,
                                                   @AuthenticationPrincipal Jwt jwt) {
        return service.changeUserStatus(id, request.status(), actor(jwt));
    }

    @GetMapping("/devices")
    public List<DeviceAdministrationResponse> findDevices() { return service.findDevices(); }

    @PostMapping("/devices/{id}/revoke")
    public DeviceAdministrationResponse revokeDevice(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.revokeDevice(id, actor(jwt));
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }

    public record StatusRequest(@NotBlank String status) {}
}
