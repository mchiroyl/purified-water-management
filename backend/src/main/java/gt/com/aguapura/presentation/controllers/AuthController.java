package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.auth.AuthResponse;
import gt.com.aguapura.application.dto.auth.LoginRequest;
import gt.com.aguapura.application.services.AuthApplicationService;
import gt.com.aguapura.infrastructure.configuration.SecurityProperties;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "agua_pura_refresh";

    private final AuthApplicationService service;
    private final SecurityProperties properties;

    public AuthController(AuthApplicationService service, SecurityProperties properties) {
        this.service = service;
        this.properties = properties;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        var result = service.login(request);
        return withRefreshCookie(result.response(), result.refreshToken());
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        var result = service.refresh(refreshToken);
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

    private ResponseEntity<AuthResponse> withRefreshCookie(AuthResponse response, String refreshToken) {
        var cookie = ResponseCookie.from(REFRESH_COOKIE, refreshToken)
                .httpOnly(true).secure(properties.cookieSecure()).sameSite("Strict")
                .path("/api/auth").maxAge(properties.refreshTokenDuration()).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(response);
    }
}
