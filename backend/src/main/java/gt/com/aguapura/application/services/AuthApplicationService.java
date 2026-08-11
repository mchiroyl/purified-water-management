package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.AuthResponse;
import gt.com.aguapura.application.dto.auth.AuthenticationResult;
import gt.com.aguapura.application.dto.auth.ChangePasswordRequest;
import gt.com.aguapura.application.dto.auth.LoginRequest;
import gt.com.aguapura.application.dto.auth.SessionUserResponse;
import gt.com.aguapura.application.ports.AccessTokenIssuer;
import gt.com.aguapura.application.ports.AuthenticationPersistencePort;
import gt.com.aguapura.application.ports.OpaqueTokenPort;
import gt.com.aguapura.application.ports.PasswordHashingPort;
import gt.com.aguapura.application.ports.PasswordVerificationPort;
import gt.com.aguapura.application.ports.SessionPolicy;
import gt.com.aguapura.domain.enums.DeviceStatus;
import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthApplicationService {

    private static final int MAXIMUM_FAILED_ATTEMPTS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final AuthenticationPersistencePort persistence;
    private final PasswordVerificationPort passwordVerifier;
    private final AccessTokenIssuer jwtTokens;
    private final OpaqueTokenPort tokenHashing;
    private final SessionPolicy policy;
    private final AuditApplicationService audit;
    private final PasswordHashingPort passwordHashing;

    public AuthApplicationService(AuthenticationPersistencePort persistence,
                                  PasswordVerificationPort passwordVerifier, AccessTokenIssuer jwtTokens,
                                  OpaqueTokenPort tokenHashing, SessionPolicy policy,
                                  AuditApplicationService audit, PasswordHashingPort passwordHashing) {
        this.persistence = persistence;
        this.passwordVerifier = passwordVerifier;
        this.jwtTokens = jwtTokens;
        this.tokenHashing = tokenHashing;
        this.policy = policy;
        this.audit = audit;
        this.passwordHashing = passwordHashing;
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public AuthenticationResult login(LoginRequest request) {
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        var found = persistence.findUserByUsername(username);
        if (found.isEmpty()) {
            audit.record(null, null, "LOGIN_FAILED", "AUTHENTICATION", null, Map.of(),
                    Map.of("username", username, "reason", "INVALID_CREDENTIALS"));
            throw invalidCredentials();
        }
        var user = found.get();
        var now = Instant.now();
        user.unlockIfExpired(now);
        if (user.isTemporarilyLocked(now)) {
            audit.record(user.getId(), null, "LOGIN_FAILED", "AUTHENTICATION", user.getId(), Map.of(),
                    Map.of("username", username, "reason", "TEMPORARILY_LOCKED"));
            throw invalidCredentials();
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            audit.record(user.getId(), null, "LOGIN_FAILED", "AUTHENTICATION", user.getId(), Map.of(),
                    Map.of("username", username, "reason", "ACCOUNT_UNAVAILABLE"));
            throw invalidCredentials();
        }
        if (!passwordVerifier.matches(request.password(), user.getPasswordHash())) {
            user.registerFailedAttempt(MAXIMUM_FAILED_ATTEMPTS, now.plus(LOCK_DURATION));
            persistence.saveUser(user);
            audit.record(user.getId(), null, "LOGIN_FAILED", "AUTHENTICATION", user.getId(), Map.of(),
                    Map.of("username", username, "reason", "INVALID_CREDENTIALS"));
            throw invalidCredentials();
        }
        user.registerSuccessfulLogin();
        var device = persistence.findActiveDevice(user.getId(), request.deviceName())
                .orElseGet(() -> persistence.createDevice(user.getId(), request.deviceName(), request.appVersion()));
        device.seen(request.appVersion());
        persistence.saveDevice(device);
        persistence.saveUser(user);
        return issueSession(user, device.getId(), UUID.randomUUID());
    }

    @Transactional
    public AuthenticationResult refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw invalidRefresh();
        }
        var tokenHash = tokenHashing.sha256(rawRefreshToken);
        var existing = persistence.findSessionByTokenHash(tokenHash).orElseThrow(AuthApplicationService::invalidRefresh);
        if (existing.getRevokedAt() != null) {
            persistence.revokeFamily(existing.getFamilyId(), Instant.now(), "REFRESH_TOKEN_REUSE");
            throw invalidRefresh();
        }
        if (!existing.getExpiresAt().isAfter(Instant.now())) {
            existing.revoke("EXPIRED", null);
            persistence.saveSession(existing);
            throw invalidRefresh();
        }
        var user = persistence.findUserById(existing.getUserId()).orElseThrow(AuthApplicationService::invalidRefresh);
        var device = persistence.findDeviceById(existing.getDeviceId()).orElseThrow(AuthApplicationService::invalidRefresh);
        if (user.getStatus() != UserStatus.ACTIVE || device.getStatus() != DeviceStatus.ACTIVE) {
            throw invalidRefresh();
        }

        var newRawToken = tokenHashing.newOpaqueToken();
        var now = Instant.now();
        var replacement = persistence.createSession(user.getId(), device.getId(), existing.getFamilyId(),
                tokenHashing.sha256(newRawToken), now, now.plus(policy.refreshTokenDuration()));
        existing.revoke("ROTATED", replacement.getId());
        persistence.saveSession(existing);

        var access = jwtTokens.issue(user, device.getId());
        return new AuthenticationResult(toResponse(user, device.getId(), access), newRawToken);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) return;
        persistence.findSessionByTokenHash(tokenHashing.sha256(rawRefreshToken))
                .ifPresent(session -> {
                    session.revoke("LOGOUT", null);
                    persistence.saveSession(session);
                    audit.record(session.getUserId(), session.getDeviceId(), "LOGOUT", "AUTHENTICATION",
                            session.getUserId(), Map.of(), Map.of("reason", "USER_REQUEST"));
                });
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        var user = persistence.findUserById(userId).orElseThrow(AuthApplicationService::invalidCredentials);
        if (user.getStatus() != UserStatus.ACTIVE
                || !passwordVerifier.matches(request.currentPassword(), user.getPasswordHash())) {
            throw invalidCredentials();
        }
        if (passwordVerifier.matches(request.newPassword(), user.getPasswordHash())) {
            throw new BusinessException("PASSWORD_REUSE", "La nueva contrasena debe ser diferente.", ErrorCategory.VALIDATION);
        }
        user.changePassword(passwordHashing.encode(request.newPassword()));
        persistence.saveUser(user);
        Instant now = Instant.now();
        persistence.revokeUserSessions(userId, now, "PASSWORD_CHANGED");
        audit.record(userId, null, "PASSWORD_CHANGED", "AUTHENTICATION", userId, Map.of(),
                Map.of("sessionsRevoked", true));
    }

    private AuthenticationResult issueSession(AuthenticationPersistencePort.AuthUser user, UUID deviceId, UUID familyId) {
        var rawRefreshToken = tokenHashing.newOpaqueToken();
        var now = Instant.now();
        persistence.createSession(user.getId(), deviceId, familyId,
                tokenHashing.sha256(rawRefreshToken), now, now.plus(policy.refreshTokenDuration()));
        var access = jwtTokens.issue(user, deviceId);
        return new AuthenticationResult(toResponse(user, deviceId, access), rawRefreshToken);
    }

    private AuthResponse toResponse(AuthenticationPersistencePort.AuthUser user, UUID deviceId,
                                    AccessTokenIssuer.IssuedAccessToken access) {
        Set<String> roles = user.getRoleCodes();
        var responseUser = new SessionUserResponse(user.getId(), user.getUsername(), user.getUsername(), deviceId,
                roles, user.isMustChangePassword());
        return new AuthResponse(access.value(), access.expiresAt(), responseUser);
    }

    private static BusinessException invalidCredentials() {
        return new BusinessException("AUTH_INVALID_CREDENTIALS", "Usuario o contraseña inválidos.", ErrorCategory.UNAUTHORIZED);
    }

    private static BusinessException invalidRefresh() {
        return new BusinessException("AUTH_INVALID_REFRESH", "La sesión no es válida o expiró.", ErrorCategory.UNAUTHORIZED);
    }
}
