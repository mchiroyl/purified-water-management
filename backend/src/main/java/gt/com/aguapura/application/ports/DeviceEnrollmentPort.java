package gt.com.aguapura.application.ports;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceEnrollmentPort {
    Optional<UserView> findUser(UUID userId);
    InvitationView create(UUID userId, String tokenHash, UUID createdBy, Instant expiresAt);
    Optional<InvitationView> findByTokenHashForUpdate(String tokenHash);
    void revokePendingForUser(UUID userId, Instant revokedAt);
    void complete(UUID invitationId, Instant consumedAt);
    void expire(UUID invitationId, Instant expiredAt);
    void revoke(UUID invitationId, Instant revokedAt);
    List<InvitationView> findAll();

    AuthenticationPersistencePort.AuthDevice createDevice(UUID userId, String friendlyName, String appVersion);

    record UserView(UUID id, String username, String status) {}

    record InvitationView(UUID id, UUID userId, String username, String status,
                          UUID createdBy, Instant createdAt, Instant expiresAt,
                          Instant consumedAt, Instant revokedAt, String tokenHash) {}
}
