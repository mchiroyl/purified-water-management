package gt.com.aguapura.application.dto.auth;

public record AuthenticationResult(AuthResponse response, String refreshToken) {
}
