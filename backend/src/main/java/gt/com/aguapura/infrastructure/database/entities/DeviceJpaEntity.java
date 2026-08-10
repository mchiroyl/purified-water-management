package gt.com.aguapura.infrastructure.database.entities;

import gt.com.aguapura.domain.enums.DeviceStatus;
import gt.com.aguapura.application.ports.AuthenticationPersistencePort;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "device")
public class DeviceJpaEntity implements AuthenticationPersistencePort.AuthDevice {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "friendly_name", nullable = false, length = 100)
    private String friendlyName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeviceStatus status = DeviceStatus.ACTIVE;

    @Column(name = "app_version", length = 40)
    private String appVersion;

    @Column(name = "first_seen_at", nullable = false)
    private Instant firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoked_by")
    private UUID revokedBy;

    protected DeviceJpaEntity() {
    }

    public DeviceJpaEntity(UUID userId, String friendlyName, String appVersion) {
        this.userId = userId;
        this.friendlyName = friendlyName;
        this.appVersion = appVersion;
    }

    @PrePersist
    void beforeInsert() {
        var now = Instant.now();
        firstSeenAt = now;
        lastSeenAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public DeviceStatus getStatus() {
        return status;
    }

    public void seen(String currentAppVersion) {
        lastSeenAt = Instant.now();
        if (currentAppVersion != null && !currentAppVersion.isBlank()) {
            appVersion = currentAppVersion;
        }
    }
}
