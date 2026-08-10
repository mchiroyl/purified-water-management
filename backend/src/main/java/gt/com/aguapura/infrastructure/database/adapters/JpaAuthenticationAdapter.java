package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.AuthenticationPersistencePort;
import gt.com.aguapura.domain.enums.DeviceStatus;
import gt.com.aguapura.infrastructure.database.entities.DeviceJpaEntity;
import gt.com.aguapura.infrastructure.database.entities.RefreshSessionJpaEntity;
import gt.com.aguapura.infrastructure.repositories.DeviceJpaRepository;
import gt.com.aguapura.infrastructure.repositories.RefreshSessionJpaRepository;
import gt.com.aguapura.infrastructure.repositories.UserJpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JpaAuthenticationAdapter implements AuthenticationPersistencePort {
    private final UserJpaRepository users;
    private final DeviceJpaRepository devices;
    private final RefreshSessionJpaRepository sessions;

    public JpaAuthenticationAdapter(UserJpaRepository users, DeviceJpaRepository devices,
                                    RefreshSessionJpaRepository sessions) {
        this.users = users; this.devices = devices; this.sessions = sessions;
    }

    public Optional<AuthUser> findUserByUsername(String username) { return users.findByUsername(username).map(user -> user); }
    public Optional<AuthUser> findUserById(UUID id) { return users.findById(id).map(user -> user); }
    public void saveUser(AuthUser user) { users.save((gt.com.aguapura.infrastructure.database.entities.UserJpaEntity) user); }
    public Optional<AuthDevice> findActiveDevice(UUID userId, String name) {
        return devices.findFirstByUserIdAndFriendlyNameAndStatus(userId, name, DeviceStatus.ACTIVE).map(device -> device);
    }
    public Optional<AuthDevice> findDeviceById(UUID id) { return devices.findById(id).map(device -> device); }
    public AuthDevice createDevice(UUID userId, String name, String version) { return devices.save(new DeviceJpaEntity(userId, name, version)); }
    public void saveDevice(AuthDevice device) { devices.save((DeviceJpaEntity) device); }
    public Optional<AuthSession> findSessionByTokenHash(String hash) { return sessions.findByTokenHash(hash).map(session -> session); }
    public AuthSession createSession(UUID userId, UUID deviceId, UUID familyId, String hash, Instant issuedAt, Instant expiresAt) {
        return sessions.save(new RefreshSessionJpaEntity(userId, deviceId, familyId, hash, issuedAt, expiresAt));
    }
    public void saveSession(AuthSession session) { sessions.save((RefreshSessionJpaEntity) session); }
    public void revokeFamily(UUID familyId, Instant revokedAt, String reason) { sessions.revokeFamily(familyId, revokedAt, reason); }
}
