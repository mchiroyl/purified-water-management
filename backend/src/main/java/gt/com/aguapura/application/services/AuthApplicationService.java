package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.AuthResponse;
import gt.com.aguapura.application.dto.auth.AuthenticationResult;
import gt.com.aguapura.application.dto.auth.LoginRequest;
import gt.com.aguapura.application.dto.auth.SessionUserResponse;
import gt.com.aguapura.domain.enums.DeviceStatus;
import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.infrastructure.configuration.SecurityProperties;
import gt.com.aguapura.infrastructure.database.entities.DeviceJpaEntity;
import gt.com.aguapura.infrastructure.database.entities.RefreshSessionJpaEntity;
import gt.com.aguapura.infrastructure.database.entities.UserJpaEntity;
import gt.com.aguapura.infrastructure.repositories.DeviceJpaRepository;
import gt.com.aguapura.infrastructure.repositories.RefreshSessionJpaRepository;
import gt.com.aguapura.infrastructure.repositories.UserJpaRepository;
import gt.com.aguapura.infrastructure.security.JwtTokenService;
import gt.com.aguapura.infrastructure.security.TokenHashingService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthApplicationService {

    private static final int MAXIMUM_FAILED_ATTEMPTS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final UserJpaRepository users;
    private final DeviceJpaRepository devices;
    private final RefreshSessionJpaRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokens;
    private final TokenHashingService tokenHashing;
    private final SecurityProperties properties;

    public AuthApplicationService(UserJpaRepository users, DeviceJpaRepository devices,
                                  RefreshSessionJpaRepository sessions, PasswordEncoder passwordEncoder,
                                  JwtTokenService jwtTokens, TokenHashingService tokenHashing,
                                  SecurityProperties properties) {
        this.users = users;
        this.devices = devices;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokens = jwtTokens;
        this.tokenHashing = tokenHashing;
        this.properties = properties;
    }

    @Transactional
    public AuthenticationResult login(LoginRequest request) {
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        UserJpaEntity user = users.findByUsername(username).orElseThrow(AuthApplicationService::invalidCredentials);
        var now = Instant.now();
        user.unlockIfExpired(now);
        if (user.isTemporarilyLocked(now)) {
            throw new BusinessException("AUTH_TEMPORARILY_LOCKED", "La cuenta está bloqueada temporalmente.", ErrorCategory.UNAUTHORIZED);
        }
        if (user.getStatus() != UserStatus.ACTIVE || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            user.registerFailedAttempt(MAXIMUM_FAILED_ATTEMPTS, now.plus(LOCK_DURATION));
            users.save(user);
            throw invalidCredentials();
        }
        user.registerSuccessfulLogin();
        var device = devices.findFirstByUserIdAndFriendlyNameAndStatus(user.getId(), request.deviceName(), DeviceStatus.ACTIVE)
                .orElseGet(() -> devices.save(new DeviceJpaEntity(user.getId(), request.deviceName(), request.appVersion())));
        device.seen(request.appVersion());
        devices.save(device);
        users.save(user);
        return issueSession(user, device.getId(), UUID.randomUUID());
    }

    @Transactional
    public AuthenticationResult refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw invalidRefresh();
        }
        var tokenHash = tokenHashing.sha256(rawRefreshToken);
        var existing = sessions.findByTokenHash(tokenHash).orElseThrow(AuthApplicationService::invalidRefresh);
        if (existing.getRevokedAt() != null) {
            sessions.revokeFamily(existing.getFamilyId(), Instant.now(), "REFRESH_TOKEN_REUSE");
            throw invalidRefresh();
        }
        if (!existing.getExpiresAt().isAfter(Instant.now())) {
            existing.revoke("EXPIRED", null);
            sessions.save(existing);
            throw invalidRefresh();
        }
        var user = users.findById(existing.getUserId()).orElseThrow(AuthApplicationService::invalidRefresh);
        var device = devices.findById(existing.getDeviceId()).orElseThrow(AuthApplicationService::invalidRefresh);
        if (user.getStatus() != UserStatus.ACTIVE || device.getStatus() != DeviceStatus.ACTIVE) {
            throw invalidRefresh();
        }

        var newRawToken = tokenHashing.newOpaqueToken();
        var now = Instant.now();
        var replacement = new RefreshSessionJpaEntity(user.getId(), device.getId(), existing.getFamilyId(),
                tokenHashing.sha256(newRawToken), now, now.plus(properties.refreshTokenDuration()));
        sessions.save(replacement);
        existing.revoke("ROTATED", replacement.getId());
        sessions.save(existing);

        var access = jwtTokens.issue(user, device.getId());
        return new AuthenticationResult(toResponse(user, access), newRawToken);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) return;
        sessions.findByTokenHash(tokenHashing.sha256(rawRefreshToken))
                .ifPresent(session -> {
                    session.revoke("LOGOUT", null);
                    sessions.save(session);
                });
    }

    private AuthenticationResult issueSession(UserJpaEntity user, UUID deviceId, UUID familyId) {
        var rawRefreshToken = tokenHashing.newOpaqueToken();
        var now = Instant.now();
        sessions.save(new RefreshSessionJpaEntity(user.getId(), deviceId, familyId,
                tokenHashing.sha256(rawRefreshToken), now, now.plus(properties.refreshTokenDuration())));
        var access = jwtTokens.issue(user, deviceId);
        return new AuthenticationResult(toResponse(user, access), rawRefreshToken);
    }

    private AuthResponse toResponse(UserJpaEntity user, JwtTokenService.IssuedAccessToken access) {
        Set<String> roles = user.getRoles().stream().map(role -> role.getCode()).collect(Collectors.toUnmodifiableSet());
        var responseUser = new SessionUserResponse(user.getId(), user.getUsername(), user.getUsername(), roles, user.isMustChangePassword());
        return new AuthResponse(access.value(), access.expiresAt(), responseUser);
    }

    private static BusinessException invalidCredentials() {
        return new BusinessException("AUTH_INVALID_CREDENTIALS", "Usuario o contraseña inválidos.", ErrorCategory.UNAUTHORIZED);
    }

    private static BusinessException invalidRefresh() {
        return new BusinessException("AUTH_INVALID_REFRESH", "La sesión no es válida o expiró.", ErrorCategory.UNAUTHORIZED);
    }
}
