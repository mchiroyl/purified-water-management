package gt.com.aguapura.infrastructure.repositories;
import gt.com.aguapura.infrastructure.database.entities.DeviceReenrollmentRequestJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface DeviceReenrollmentRequestJpaRepository extends JpaRepository<DeviceReenrollmentRequestJpaEntity, UUID> {
    Optional<DeviceReenrollmentRequestJpaEntity> findByTokenHash(String tokenHash);

    Optional<DeviceReenrollmentRequestJpaEntity> findFirstByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, String status);

    List<DeviceReenrollmentRequestJpaEntity> findAllByOrderByCreatedAtDesc();
}
