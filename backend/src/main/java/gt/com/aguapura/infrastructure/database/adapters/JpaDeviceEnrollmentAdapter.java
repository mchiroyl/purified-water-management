package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.AuthenticationPersistencePort;
import gt.com.aguapura.application.ports.DeviceEnrollmentPort;
import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.infrastructure.database.entities.DeviceEnrollmentInvitationJpaEntity;
import gt.com.aguapura.infrastructure.database.entities.DeviceJpaEntity;
import gt.com.aguapura.infrastructure.repositories.DeviceEnrollmentInvitationJpaRepository;
import gt.com.aguapura.infrastructure.repositories.DeviceJpaRepository;
import gt.com.aguapura.infrastructure.repositories.UserJpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JpaDeviceEnrollmentAdapter implements DeviceEnrollmentPort {
    private final UserJpaRepository users;
    private final DeviceJpaRepository devices;
    private final DeviceEnrollmentInvitationJpaRepository invitations;
    public JpaDeviceEnrollmentAdapter(UserJpaRepository users, DeviceJpaRepository devices,
                                      DeviceEnrollmentInvitationJpaRepository invitations) {
        this.users = users; this.devices = devices; this.invitations = invitations;
    }
    public Optional<UserView> findUser(UUID id) {
        return users.findById(id).map(user -> new UserView(user.getId(), user.getUsername(), user.getStatus().name()));
    }
    public InvitationView create(UUID userId, String hash, UUID actor, Instant expiresAt) {
        return view(invitations.save(new DeviceEnrollmentInvitationJpaEntity(userId, hash, actor, expiresAt)));
    }
    public Optional<InvitationView> findByTokenHashForUpdate(String hash) {
        return invitations.findByTokenHash(hash).map(this::view);
    }
    public void revokePendingForUser(UUID userId, Instant at) {
        invitations.findByUserIdAndStatus(userId, DeviceEnrollmentInvitationJpaEntity.Status.PENDING)
                .forEach(item -> item.revoke(at));
    }
    public void complete(UUID id, Instant at) { invitations.findById(id).ifPresent(item -> { item.complete(at); invitations.save(item); }); }
    public void expire(UUID id, Instant at) { invitations.findById(id).ifPresent(item -> { item.expire(at); invitations.save(item); }); }
    public void revoke(UUID id, Instant at) { invitations.findById(id).ifPresent(item -> { item.revoke(at); invitations.save(item); }); }
    public List<InvitationView> findAll() {
        return invitations.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))
                .stream().map(this::view).toList();
    }
    public AuthenticationPersistencePort.AuthDevice createDevice(UUID userId, String name, String version) {
        return devices.saveAndFlush(new DeviceJpaEntity(userId, name, version));
    }
    private InvitationView view(DeviceEnrollmentInvitationJpaEntity item) {
        String username = users.findById(item.getUserId()).map(user -> user.getUsername()).orElse("");
        return new InvitationView(item.getId(), item.getUserId(), username, item.getStatus().name(),
                item.getCreatedBy(), item.getCreatedAt(), item.getExpiresAt(), item.getConsumedAt(),
                item.getRevokedAt(), item.getTokenHash());
    }
}
