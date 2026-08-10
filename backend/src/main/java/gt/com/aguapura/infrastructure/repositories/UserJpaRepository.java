package gt.com.aguapura.infrastructure.repositories;

import gt.com.aguapura.infrastructure.database.entities.UserJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserJpaRepository extends JpaRepository<UserJpaEntity, UUID> {
    Optional<UserJpaEntity> findByUsername(String username);
    boolean existsByUsername(String username);
}
