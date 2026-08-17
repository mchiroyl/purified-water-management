package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.catalog.CreatePresentationTemplateRequest;
import gt.com.aguapura.application.dto.catalog.PresentationTemplateResponse;
import gt.com.aguapura.application.ports.ProductCatalogPersistencePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class PresentationCatalogApplicationService {
    private final ProductCatalogPersistencePort persistence;

    public PresentationCatalogApplicationService(ProductCatalogPersistencePort persistence) {
        this.persistence = persistence;
    }

    @Transactional
    public PresentationTemplateResponse create(CreatePresentationTemplateRequest request) {
        String unit = normalize(request.unitCode());
        if (!persistence.unitExists(unit)) {
            throw new BusinessException("UNIT_NOT_FOUND", "La unidad de medida no existe: " + unit,
                    ErrorCategory.VALIDATION);
        }
        String code = request.code() == null || request.code().isBlank()
                ? persistence.nextPresentationCode() : normalize(request.code());
        var template = template(code, request, unit);
        ensureNoDuplicate(template, null);
        return response(persistence.createPresentationTemplate(template));
    }

    @Transactional(readOnly = true)
    public List<PresentationTemplateResponse> findAll(String query) {
        return persistence.findPresentationTemplates(query).stream().map(this::response).toList();
    }

    @Transactional
    public PresentationTemplateResponse update(java.util.UUID id, CreatePresentationTemplateRequest request) {
        String unit = normalize(request.unitCode());
        if (!persistence.unitExists(unit)) throw new BusinessException("UNIT_NOT_FOUND", "La unidad de medida no existe: " + unit, ErrorCategory.VALIDATION);
        var template = template("", request, unit);
        ensureNoDuplicate(template, id);
        return response(persistence.updatePresentationTemplate(id, template));
    }

    @Transactional
    public PresentationTemplateResponse setActive(java.util.UUID id, boolean active) {
        return response(persistence.setPresentationTemplateActive(id, active));
    }

    @Transactional
    public void delete(java.util.UUID id) { persistence.deletePresentationTemplate(id); }

    private PresentationTemplateResponse response(ProductCatalogPersistencePort.CatalogPresentationTemplate item) {
        return new PresentationTemplateResponse(item.id(), item.code(), item.name(), item.presentationType(),
                item.contentQuantity(), item.contentUnit(), item.unitCode(), item.conversionFactor(), item.active());
    }

    private String normalize(String value) { return value.trim().toUpperCase(Locale.ROOT); }

    private ProductCatalogPersistencePort.NewPresentationTemplate template(String code,
            CreatePresentationTemplateRequest request, String inventoryUnit) {
        String type = request.presentationType().trim().toUpperCase(Locale.ROOT);
        String contentUnit = normalize(request.contentUnit());
        String name = type + " " + request.contentQuantity().stripTrailingZeros().toPlainString() + " " + contentUnit;
        return new ProductCatalogPersistencePort.NewPresentationTemplate(code, name, type, request.contentQuantity(),
                contentUnit, inventoryUnit, request.conversionFactor());
    }

    private void ensureNoDuplicate(ProductCatalogPersistencePort.NewPresentationTemplate candidate,
                                   java.util.UUID excludedId) {
        boolean duplicate = persistence.findPresentationTemplates("").stream().anyMatch(item ->
                !item.id().equals(excludedId)
                        && item.presentationType().equalsIgnoreCase(candidate.presentationType())
                        && item.contentUnit().equalsIgnoreCase(candidate.contentUnit())
                        && item.unitCode().equalsIgnoreCase(candidate.unitCode())
                        && item.contentQuantity().compareTo(candidate.contentQuantity()) == 0
                        && item.conversionFactor().compareTo(candidate.conversionFactor()) == 0);
        if (duplicate) {
            throw new BusinessException("DUPLICATE_PRESENTATION", "Esta presentación ya está registrada.",
                    ErrorCategory.CONFLICT);
        }
    }
}
