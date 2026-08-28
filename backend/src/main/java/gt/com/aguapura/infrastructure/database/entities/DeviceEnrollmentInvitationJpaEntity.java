package gt.com.aguapura.infrastructure.database.entities;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "device_enrollment_invitation")
public class DeviceEnrollmentInvitationJpaEntity {
    @Id
    private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status = Status.PENDING;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "consumed_at") private Instant consumedAt;
    @Column(name = "revoked_at") private Instant revokedAt;
    protected DeviceEnrollmentInvitationJpaEntity() {}
    public DeviceEnrollmentInvitationJpaEntity(UUID userId, String tokenHash, UUID createdBy, Instant expiresAt) {
        this.id = UUID.randomUUID(); this.userId = userId; this.tokenHash = tokenHash;
        this.createdBy = createdBy; this.createdAt = Instant.now(); this.expiresAt = expiresAt;
    }
    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getTokenHash() { return tokenHash; }
    public Status getStatus() { return status; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getConsumedAt() { return consumedAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void complete(Instant at) { status = Status.COMPLETED; consumedAt = at; }
    public void expire(Instant at) { status = Status.EXPIRED; revokedAt = at; }
    public void revoke(Instant at) { status = Status.REVOKED; revokedAt = at; }
    public enum Status { PENDING, COMPLETED, REVOKED, EXPIRED }
}
