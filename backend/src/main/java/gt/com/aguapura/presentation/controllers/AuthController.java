package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.auth.AuthResponse;
import gt.com.aguapura.application.dto.auth.ChangePasswordRequest;
import gt.com.aguapura.application.dto.auth.LoginRequest;
import gt.com.aguapura.application.dto.auth.DeviceReenrollmentRequest;
import gt.com.aguapura.application.dto.auth.DeviceReenrollmentResponse;
import gt.com.aguapura.application.services.DeviceReenrollmentApplicationService;
import gt.com.aguapura.application.services.AuthApplicationService;
import gt.com.aguapura.application.services.AuditApplicationService;
import gt.com.aguapura.application.services.DeviceEnrollmentApplicationService;
import gt.com.aguapura.infrastructure.configuration.SecurityProperties;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "agua_pura_refresh";

    private final AuthApplicationService service;
    private final SecurityProperties properties;
    private final AuditApplicationService audit;
    private final DeviceReenrollmentApplicationService reenrollment;

    public AuthController(AuthApplicationService service, SecurityProperties properties,
                          AuditApplicationService audit, DeviceReenrollmentApplicationService reenrollment) {
        this.service = service;
        this.properties = properties;
        this.audit = audit;
        this.reenrollment = reenrollment;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        var result = service.login(request);
        audit.record(result.response().user().id(), result.response().user().deviceId(), "LOGIN",
                "AUTHENTICATION", result.response().user().id(), Map.of(),
                Map.of("username", result.response().user().username(), "deviceName", request.deviceName()));
        return withRefreshCookie(result.response(), result.refreshToken());
    }

    @PostMapping("/device-reenrollment/request")
    public DeviceReenrollmentResponse requestDeviceReenrollment(@Valid @RequestBody DeviceReenrollmentRequest request) {
        return reenrollment.request(request);
    }

    @GetMapping("/device-reenrollment/{token}/status")
    public DeviceReenrollmentResponse deviceReenrollmentStatus(@PathVariable String token) { return reenrollment.status(token); }

    @PostMapping("/device-reenrollment/{token}/complete")
    public DeviceReenrollmentResponse completeDeviceReenrollment(@PathVariable String token) { return reenrollment.complete(token); }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        var result = service.refresh(refreshToken);
        return withRefreshCookie(result.response(), result.refreshToken());
    }

    @PostMapping("/device-enrollment")
    public ResponseEntity<AuthResponse> deviceEnrollment(@Valid @RequestBody DeviceEnrollmentRequest request) {
        var result = enrollment.accept(request);
        return withRefreshCookie(result.response(), result.refreshToken());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        service.logout(refreshToken);
        var expired = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true).secure(properties.cookieSecure()).sameSite("Strict")
                .path("/api/auth").maxAge(0).build();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, expired.toString()).build();
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                               @AuthenticationPrincipal Jwt jwt) {
        service.changePassword(java.util.UUID.fromString(jwt.getClaimAsString("userId")), request);
        var expired = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true).secure(properties.cookieSecure()).sameSite("Strict")
                .path("/api/auth").maxAge(0).build();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, expired.toString()).build();
    }

    private ResponseEntity<AuthResponse> withRefreshCookie(AuthResponse response, String refreshToken) {
        var cookie = ResponseCookie.from(REFRESH_COOKIE, refreshToken)
                .httpOnly(true).secure(properties.cookieSecure()).sameSite("Strict")
                .path("/api/auth").maxAge(properties.refreshTokenDuration()).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(response);
    }
}
