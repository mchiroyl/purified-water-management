package gt.com.aguapura.application.ports;

import gt.com.aguapura.domain.enums.DeviceStatus;
import gt.com.aguapura.domain.enums.UserStatus;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface AuthenticationPersistencePort {
    Optional<AuthUser> findUserByUsername(String username);
    Optional<AuthUser> findUserById(UUID id);
    void saveUser(AuthUser user);
    Optional<AuthDevice> findActiveDevice(UUID userId, String friendlyName);
    Optional<AuthDevice> findDeviceById(UUID id);
    AuthDevice createDevice(UUID userId, String friendlyName, String appVersion);
    void saveDevice(AuthDevice device);
    Optional<AuthSession> findSessionByTokenHash(String tokenHash);
    AuthSession createSession(UUID userId, UUID deviceId, UUID familyId, String tokenHash,
                              Instant issuedAt, Instant expiresAt);
    void saveSession(AuthSession session);
    void revokeFamily(UUID familyId, Instant revokedAt, String reason);
    void revokeUserSessions(UUID userId, Instant revokedAt, String reason);

    interface AuthUser {
        UUID getId();
        String getUsername();
        String getPasswordHash();
        UserStatus getStatus();
        boolean isMustChangePassword();
        Set<String> getRoleCodes();
        void registerFailedAttempt(int maximumAttempts, Instant lockUntil);
        void registerSuccessfulLogin();
        boolean isTemporarilyLocked(Instant now);
        void unlockIfExpired(Instant now);
        void changePassword(String newPasswordHash);
    }

    interface AuthDevice {
        UUID getId();
        DeviceStatus getStatus();
        void seen(String currentAppVersion);
    }

    interface AuthSession {
        UUID getId();
        UUID getUserId();
        UUID getDeviceId();
        UUID getFamilyId();
        Instant getExpiresAt();
        Instant getRevokedAt();
        void revoke(String reason, UUID replacementId);
    }
}
