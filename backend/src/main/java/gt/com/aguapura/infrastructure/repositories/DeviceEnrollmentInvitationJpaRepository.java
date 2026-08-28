package gt.com.aguapura.infrastructure.repositories;

import gt.com.aguapura.infrastructure.database.entities.DeviceEnrollmentInvitationJpaEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceEnrollmentInvitationJpaRepository
        extends JpaRepository<DeviceEnrollmentInvitationJpaEntity, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<DeviceEnrollmentInvitationJpaEntity> findByTokenHash(String tokenHash);
    List<DeviceEnrollmentInvitationJpaEntity> findByUserIdAndStatus(
            UUID userId, DeviceEnrollmentInvitationJpaEntity.Status status);
}
