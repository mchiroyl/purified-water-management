package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.identity.CreateUserRequest;
import gt.com.aguapura.application.dto.identity.CreateDeviceEnrollmentRequest;
import gt.com.aguapura.application.dto.identity.DeviceEnrollmentInvitationResponse;
import gt.com.aguapura.application.dto.identity.DeviceAdministrationResponse;
import gt.com.aguapura.application.dto.identity.UserAdministrationResponse;
import gt.com.aguapura.application.services.IdentityAdministrationApplicationService;
import gt.com.aguapura.application.services.DeviceEnrollmentApplicationService;
import gt.com.aguapura.application.services.AuditApplicationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/administration")
@PreAuthorize("hasRole('ADMINISTRADOR')")
@Validated
public class IdentityAdministrationController {

    private final IdentityAdministrationApplicationService service;
    private final AuditApplicationService audit;
    private final DeviceEnrollmentApplicationService enrollment;

    public IdentityAdministrationController(IdentityAdministrationApplicationService service,
                                            AuditApplicationService audit,
                                            DeviceEnrollmentApplicationService enrollment) {
        this.service = service;
        this.audit = audit;
        this.enrollment = enrollment;
    }

    @GetMapping("/users")
    public List<UserAdministrationResponse> findUsers() { return service.findUsers(); }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public UserAdministrationResponse createUser(@Valid @RequestBody CreateUserRequest request,
                                                 @AuthenticationPrincipal Jwt jwt) {
        var result = service.createUser(request);
        var after = Map.<String, Object>of("username", result.username(), "status", result.status(), "roles", result.roles());
        audit.record(actor(jwt), device(jwt), "CREATE_USER", "USER", result.id(), Map.of(), after);
        audit.record(actor(jwt), device(jwt), "ROLE_CHANGE", "USER", result.id(), Map.of(), Map.of("roles", result.roles()));
        return result;
    }

    @PatchMapping("/users/{id}/status")
    public UserAdministrationResponse changeStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest request,
                                                   @AuthenticationPrincipal Jwt jwt) {
        var result = service.changeUserStatus(id, request.status(), actor(jwt));
        audit.record(actor(jwt), device(jwt), "USER_STATUS_CHANGE", "USER", id, Map.of(),
                Map.of("status", result.status()));
        return result;
    }

    @GetMapping("/devices")
    public List<DeviceAdministrationResponse> findDevices() { return service.findDevices(); }

    @PostMapping("/devices/{id}/revoke")
    public DeviceAdministrationResponse revokeDevice(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var result = service.revokeDevice(id, actor(jwt));
        audit.record(actor(jwt), device(jwt), "DEVICE_REVOKED", "DEVICE", id, Map.of(),
                Map.of("status", result.status(), "username", result.username()));
        return result;
    }

    @GetMapping("/device-enrollment/invitations")
    public List<DeviceEnrollmentInvitationResponse> findEnrollmentInvitations() {
        return enrollment.findAll();
    }

    @PostMapping("/device-enrollment/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public DeviceEnrollmentInvitationResponse createEnrollmentInvitation(
            @Valid @RequestBody CreateDeviceEnrollmentRequest request, @AuthenticationPrincipal Jwt jwt) {
        return enrollment.create(actor(jwt), request);
    }

    @PostMapping("/device-enrollment/invitations/{id}/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeEnrollmentInvitation(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        enrollment.revoke(actor(jwt), id);
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }

    public record StatusRequest(@NotBlank String status) {}
}
