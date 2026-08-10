package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.company.CompanyConfigurationRequest;
import gt.com.aguapura.application.dto.company.CompanyConfigurationResponse;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Locale;

@Service
public class CompanyConfigurationApplicationService {

    private final CompanyConfigurationPersistencePort repository;

    public CompanyConfigurationApplicationService(CompanyConfigurationPersistencePort repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public CompanyConfigurationResponse get() {
        return repository.find().map(this::toResponse)
                .orElseThrow(() -> new BusinessException("COMPANY_CONFIGURATION_NOT_FOUND",
                        "Los datos de la empresa aún no han sido configurados.", ErrorCategory.NOT_FOUND));
    }

    @Transactional
    public CompanyConfigurationResponse upsert(CompanyConfigurationRequest request) {
        validateTimezone(request.timezone());
        var existing = repository.find().orElse(null);
        var data = new CompanyConfigurationPersistencePort.CompanyData(existing == null ? null : existing.id(),
                request.commercialName().trim(), request.legalName().trim(), request.taxId().trim(),
                request.address().trim(), safe(request.phone()), safe(request.whatsapp()), safe(request.email()),
                request.currencyCode().toUpperCase(Locale.ROOT), request.timezone(),
                request.receiptPrefix().toUpperCase(Locale.ROOT), safe(request.documentLegend()),
                existing == null ? 0 : existing.version());
        return toResponse(repository.save(data));
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

    private CompanyConfigurationResponse toResponse(CompanyConfigurationPersistencePort.CompanyData entity) {
        return new CompanyConfigurationResponse(entity.id(), entity.commercialName(), entity.legalName(),
                entity.taxId(), entity.address(), entity.phone(), entity.whatsapp(), entity.email(),
                entity.currencyCode(), entity.timezone(), entity.receiptPrefix(), entity.documentLegend(), entity.version());
    }
}
