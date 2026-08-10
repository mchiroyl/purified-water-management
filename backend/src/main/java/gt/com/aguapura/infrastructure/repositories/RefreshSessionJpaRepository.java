package gt.com.aguapura.infrastructure.repositories;

import gt.com.aguapura.infrastructure.database.entities.RefreshSessionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshSessionJpaRepository extends JpaRepository<RefreshSessionJpaEntity, UUID> {
    Optional<RefreshSessionJpaEntity> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update RefreshSessionJpaEntity s set s.revokedAt = :revokedAt, s.revokeReason = :reason where s.familyId = :familyId and s.revokedAt is null")
    int revokeFamily(UUID familyId, Instant revokedAt, String reason);

    @Modifying
    @Query("update RefreshSessionJpaEntity s set s.revokedAt = :revokedAt, s.revokeReason = :reason where s.userId = :userId and s.deviceId = :deviceId and s.revokedAt is null")
    int revokeDeviceSessions(UUID userId, UUID deviceId, Instant revokedAt, String reason);
}
