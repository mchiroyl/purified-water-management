package gt.com.aguapura.infrastructure.repositories;

import gt.com.aguapura.infrastructure.database.entities.RoleJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoleJpaRepository extends JpaRepository<RoleJpaEntity, UUID> {
    Optional<RoleJpaEntity> findByCode(String code);
}
