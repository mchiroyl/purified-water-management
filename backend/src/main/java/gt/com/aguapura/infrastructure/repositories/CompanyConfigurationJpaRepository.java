package gt.com.aguapura.infrastructure.repositories;

import gt.com.aguapura.infrastructure.database.entities.CompanyConfigurationJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CompanyConfigurationJpaRepository extends JpaRepository<CompanyConfigurationJpaEntity, UUID> {
    Optional<CompanyConfigurationJpaEntity> findBySingletonKeyTrue();
}
