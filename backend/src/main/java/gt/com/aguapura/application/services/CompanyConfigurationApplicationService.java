package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.company.CompanyConfigurationRequest;
import gt.com.aguapura.application.dto.company.CompanyConfigurationResponse;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.infrastructure.database.entities.CompanyConfigurationJpaEntity;
import gt.com.aguapura.infrastructure.repositories.CompanyConfigurationJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.ZoneId;

@Service
public class CompanyConfigurationApplicationService {

    private final CompanyConfigurationJpaRepository repository;

    public CompanyConfigurationApplicationService(CompanyConfigurationJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public CompanyConfigurationResponse get() {
        return repository.findBySingletonKeyTrue().map(this::toResponse)
                .orElseThrow(() -> new BusinessException("COMPANY_CONFIGURATION_NOT_FOUND",
                        "Los datos de la empresa aún no han sido configurados.", ErrorCategory.NOT_FOUND));
    }

    @Transactional
    public CompanyConfigurationResponse upsert(CompanyConfigurationRequest request) {
        validateTimezone(request.timezone());
        var entity = repository.findBySingletonKeyTrue().orElseGet(CompanyConfigurationJpaEntity::create);
        entity.update(request.commercialName().trim(), request.legalName().trim(), request.taxId().trim(),
                request.address().trim(), safe(request.phone()), safe(request.whatsapp()), safe(request.email()),
                request.currencyCode(), request.timezone(), request.receiptPrefix(), safe(request.documentLegend()));
        return toResponse(repository.save(entity));
    }

    private void validateTimezone(String timezone) {
        try {
            ZoneId.of(timezone);
        } catch (DateTimeException exception) {
            throw new BusinessException("INVALID_TIMEZONE", "La zona horaria no es válida.", ErrorCategory.VALIDATION);
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private CompanyConfigurationResponse toResponse(CompanyConfigurationJpaEntity entity) {
        return new CompanyConfigurationResponse(entity.getId(), entity.getCommercialName(), entity.getLegalName(),
                entity.getTaxId(), entity.getAddress(), entity.getPhone(), entity.getWhatsapp(), entity.getEmail(),
                entity.getCurrencyCode(), entity.getTimezone(), entity.getReceiptPrefix(), entity.getDocumentLegend(), entity.getVersion());
    }
}
