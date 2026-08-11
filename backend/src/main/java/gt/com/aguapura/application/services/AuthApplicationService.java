package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.AuthResponse;
import gt.com.aguapura.application.dto.auth.AuthenticationResult;
import gt.com.aguapura.application.dto.auth.LoginRequest;
import gt.com.aguapura.application.dto.auth.SessionUserResponse;
import gt.com.aguapura.application.ports.AccessTokenIssuer;
import gt.com.aguapura.application.ports.AuthenticationPersistencePort;
import gt.com.aguapura.application.ports.OpaqueTokenPort;
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

    public AuthApplicationService(AuthenticationPersistencePort persistence,
                                  PasswordVerificationPort passwordVerifier, AccessTokenIssuer jwtTokens,
                                  OpaqueTokenPort tokenHashing, SessionPolicy policy) {
        this.persistence = persistence;
        this.passwordVerifier = passwordVerifier;
        this.jwtTokens = jwtTokens;
        this.tokenHashing = tokenHashing;
        this.policy = policy;
    }

    @Transactional
    public AuthenticationResult login(LoginRequest request) {
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        var user = persistence.findUserByUsername(username).orElseThrow(AuthApplicationService::invalidCredentials);
        var now = Instant.now();
        user.unlockIfExpired(now);
        if (user.isTemporarilyLocked(now)) {
            throw new BusinessException("AUTH_TEMPORARILY_LOCKED", "La cuenta está bloqueada temporalmente.", ErrorCategory.UNAUTHORIZED);
        }
        if (user.getStatus() != UserStatus.ACTIVE || !passwordVerifier.matches(request.password(), user.getPasswordHash())) {
            user.registerFailedAttempt(MAXIMUM_FAILED_ATTEMPTS, now.plus(LOCK_DURATION));
            persistence.saveUser(user);
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
                });
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
