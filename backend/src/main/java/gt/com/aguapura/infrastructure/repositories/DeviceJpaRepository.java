package gt.com.aguapura.infrastructure.repositories;

import gt.com.aguapura.domain.enums.DeviceStatus;
import gt.com.aguapura.infrastructure.database.entities.DeviceJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DeviceJpaRepository extends JpaRepository<DeviceJpaEntity, UUID> {
    Optional<DeviceJpaEntity> findFirstByUserIdAndFriendlyNameAndStatus(UUID userId, String friendlyName, DeviceStatus status);
}
