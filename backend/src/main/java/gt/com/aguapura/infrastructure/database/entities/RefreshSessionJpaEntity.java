package gt.com.aguapura.infrastructure.database.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_session")
public class RefreshSessionJpaEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "replaced_by_id")
    private UUID replacedById;

    @Column(name = "revoke_reason", length = 100)
    private String revokeReason;

    protected RefreshSessionJpaEntity() {
    }

    public RefreshSessionJpaEntity(UUID userId, UUID deviceId, UUID familyId, String tokenHash, Instant issuedAt, Instant expiresAt) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.deviceId = deviceId;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getDeviceId() {
        return deviceId;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void revoke(String reason, UUID replacementId) {
        if (revokedAt == null) {
            revokedAt = Instant.now();
            revokeReason = reason;
            replacedById = replacementId;
        }
    }
}
