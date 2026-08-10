package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.infrastructure.database.entities.CompanyConfigurationJpaEntity;
import gt.com.aguapura.infrastructure.repositories.CompanyConfigurationJpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class JpaCompanyConfigurationAdapter implements CompanyConfigurationPersistencePort {

    private final CompanyConfigurationJpaRepository repository;

    public JpaCompanyConfigurationAdapter(CompanyConfigurationJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<CompanyData> find() {
        return repository.findBySingletonKeyTrue().map(this::toData);
    }

    @Override
    public CompanyData save(CompanyData data) {
        var entity = repository.findBySingletonKeyTrue().orElseGet(CompanyConfigurationJpaEntity::create);
        entity.update(data.commercialName(), data.legalName(), data.taxId(), data.address(), data.phone(),
                data.whatsapp(), data.email(), data.currencyCode(), data.timezone(), data.receiptPrefix(),
                data.documentLegend());
        return toData(repository.save(entity));
    }

    private CompanyData toData(CompanyConfigurationJpaEntity entity) {
        return new CompanyData(entity.getId(), entity.getCommercialName(), entity.getLegalName(), entity.getTaxId(),
                entity.getAddress(), entity.getPhone(), entity.getWhatsapp(), entity.getEmail(), entity.getCurrencyCode(),
                entity.getTimezone(), entity.getReceiptPrefix(), entity.getDocumentLegend(), entity.getVersion());
    }
}
