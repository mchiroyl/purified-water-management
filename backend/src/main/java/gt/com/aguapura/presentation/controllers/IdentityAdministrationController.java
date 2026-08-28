package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.identity.CreateUserRequest;
import gt.com.aguapura.application.dto.identity.CreateDeviceEnrollmentRequest;
import gt.com.aguapura.application.dto.identity.DeviceEnrollmentInvitationResponse;
import gt.com.aguapura.application.dto.identity.DeviceAdministrationResponse;
import gt.com.aguapura.application.dto.identity.UserAdministrationResponse;
import gt.com.aguapura.application.services.IdentityAdministrationApplicationService;
import gt.com.aguapura.application.services.DeviceEnrollmentApplicationService;
import gt.com.aguapura.application.services.AuditApplicationService;
import gt.com.aguapura.application.services.DeviceReenrollmentApplicationService;
import gt.com.aguapura.application.dto.auth.DeviceReenrollmentResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
    private final DeviceReenrollmentApplicationService reenrollment;

    public IdentityAdministrationController(IdentityAdministrationApplicationService service,
                                            AuditApplicationService audit, DeviceReenrollmentApplicationService reenrollment) {
        this.service = service;
        this.audit = audit;
        this.reenrollment = reenrollment;
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

    @GetMapping("/device-reenrollment")
    public List<DeviceReenrollmentResponse> reenrollments() { return reenrollment.list(); }

    @GetMapping("/device-reenrollment/by-token/{token}")
    public DeviceReenrollmentResponse reenrollmentByToken(@PathVariable String token) { return reenrollment.findForAdministrator(token); }

    @PostMapping("/device-reenrollment/{id}/approve")
    public DeviceReenrollmentResponse approveReenrollment(@PathVariable UUID id, @RequestBody ApproveDeviceRequest request, @AuthenticationPrincipal Jwt jwt) {
        return reenrollment.approve(id, request.deviceName(), actor(jwt));
    }

    @PostMapping("/device-reenrollment/{id}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rejectReenrollment(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { reenrollment.reject(id, actor(jwt)); }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }

    public record StatusRequest(@NotBlank String status) {}
    public record ApproveDeviceRequest(@NotBlank @Size(min = 2, max = 100) String deviceName) {}
}
