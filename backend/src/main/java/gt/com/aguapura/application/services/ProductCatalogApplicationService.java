package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.catalog.CreateProductRequest;
import gt.com.aguapura.application.dto.catalog.ProductResponse;
import gt.com.aguapura.application.dto.catalog.UpdateProductRequest;
import gt.com.aguapura.application.dto.catalog.UpdatePresentationConversionRequest;
import gt.com.aguapura.application.ports.ProductCatalogPersistencePort;
import gt.com.aguapura.domain.catalog.PresentationConversion;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProductCatalogApplicationService {

    private final ProductCatalogPersistencePort persistence;

    public ProductCatalogApplicationService(ProductCatalogPersistencePort persistence) {
        this.persistence = persistence;
    }

    @Transactional
    public ProductResponse create(CreateProductRequest request) {
        String code = request.code() == null || request.code().isBlank()
                ? persistence.nextProductCode() : normalizeCode(request.code());
        String baseUnit = normalizeCode(request.baseUnitCode());
        if (persistence.productCodeExists(code)) {
            throw new BusinessException("PRODUCT_CODE_EXISTS", "El código de producto ya existe.", ErrorCategory.CONFLICT);
        }
        requireUnit(baseUnit);

        var presentations = selectedPresentations(request);
        ensureNoDuplicate(null, request.name(), baseUnit, presentations);
        var product = new ProductCatalogPersistencePort.NewProduct(code, request.name().trim(), safe(request.description()),
                baseUnit, request.controlsInventory(), presentations);
        return toResponse(persistence.create(product));
    }

    private List<ProductCatalogPersistencePort.NewPresentation> selectedPresentations(CreateProductRequest request) {
        if (request.presentationIds() != null && !request.presentationIds().isEmpty()) {
            if (new HashSet<>(request.presentationIds()).size() != request.presentationIds().size()) {
                throw new BusinessException("DUPLICATE_PRESENTATION", "No se puede seleccionar la misma presentación dos veces.",
                        ErrorCategory.VALIDATION);
            }
            var selected = persistence.findPresentationTemplatesByIds(request.presentationIds());
            if (selected.size() != request.presentationIds().size()) {
                throw new BusinessException("PRESENTATION_NOT_FOUND", "Una presentación seleccionada no existe o está inactiva.",
                        ErrorCategory.VALIDATION);
            }
            return selected.stream().map(item -> new ProductCatalogPersistencePort.NewPresentation(
                    item.code(), item.name(), item.unitCode(), item.conversionFactor())).toList();
        }
        if (request.presentations() == null || request.presentations().isEmpty()) {
            throw new BusinessException("PRESENTATION_REQUIRED", "Seleccione al menos una presentación.",
                    ErrorCategory.VALIDATION);
        }
        var presentationCodes = new HashSet<String>();
        return request.presentations().stream().map(item -> {
            String presentationCode = item.code() == null || item.code().isBlank()
                    ? persistence.nextPresentationCode() : normalizeCode(item.code());
            if (!presentationCodes.add(presentationCode)) {
                throw new BusinessException("DUPLICATE_PRESENTATION_CODE",
                        "No se permiten códigos de presentación repetidos.", ErrorCategory.VALIDATION);
            }
            String unitCode = normalizeCode(item.unitCode());
            requireUnit(unitCode);
            var conversion = new PresentationConversion(item.conversionFactor());
            return new ProductCatalogPersistencePort.NewPresentation(presentationCode, item.name().trim(), unitCode,
                    conversion.factor());
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> findAll() {
        return persistence.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional
    public ProductResponse setActive(UUID id, boolean active) {
        if (persistence.findById(id).isEmpty()) {
            throw new BusinessException("PRODUCT_NOT_FOUND", "El producto no existe.", ErrorCategory.NOT_FOUND);
        }
        return toResponse(persistence.setActive(id, active));
    }

    @Transactional
    public ProductResponse update(UUID id, UpdateProductRequest request) {
        var current = persistence.findById(id).orElseThrow(() -> new BusinessException("PRODUCT_NOT_FOUND", "El producto no existe.", ErrorCategory.NOT_FOUND));
        String unit = normalizeCode(request.baseUnitCode());
        requireUnit(unit);
        var presentations = current.presentations().stream().map(item -> new ProductCatalogPersistencePort.NewPresentation(
                item.code(), item.name(), item.unitCode(), item.conversionFactor())).toList();
        if (!sameProductIdentity(current, request.name(), unit, presentations)) {
            ensureNoDuplicate(id, request.name(), unit, presentations);
        }
        return toResponse(persistence.updateProduct(id, request.name().trim(), safe(request.description()), unit,
                request.controlsInventory()));
    }

    @Transactional
    public void delete(UUID id) {
        if (persistence.findById(id).isEmpty()) throw new BusinessException("PRODUCT_NOT_FOUND", "El producto no existe.", ErrorCategory.NOT_FOUND);
        persistence.deleteProduct(id);
    }

    @Transactional
    public ProductResponse updateConversion(UUID productId, UUID presentationId,
                                            UpdatePresentationConversionRequest request) {
        requirePresentation(productId, presentationId);
        var conversion = new PresentationConversion(request.conversionFactor());
        return toResponse(persistence.updateConversion(productId, presentationId, conversion.factor()));
    }

    @Transactional
    public ProductResponse setPresentationActive(UUID productId, UUID presentationId, boolean active) {
        requirePresentation(productId, presentationId);
        return toResponse(persistence.setPresentationActive(productId, presentationId, active));
    }

    private void requirePresentation(UUID productId, UUID presentationId) {
        var product = persistence.findById(productId).orElseThrow(() -> new BusinessException(
                "PRODUCT_NOT_FOUND", "El producto no existe.", ErrorCategory.NOT_FOUND));
        if (product.presentations().stream().noneMatch(item -> item.id().equals(presentationId))) {
            throw new BusinessException("PRESENTATION_NOT_FOUND", "La presentación no pertenece al producto.",
                    ErrorCategory.NOT_FOUND);
        }
    }

    private void requireUnit(String code) {
        if (!persistence.unitExists(code)) {
            throw new BusinessException("UNIT_NOT_FOUND", "La unidad de medida no existe: " + code,
                    ErrorCategory.VALIDATION);
        }
    }

    private void ensureNoDuplicate(UUID excludedId, String name, String baseUnit,
                                   List<ProductCatalogPersistencePort.NewPresentation> presentations) {
        boolean duplicate = persistence.findAll().stream()
                .filter(product -> !product.id().equals(excludedId))
                .anyMatch(product -> sameProductIdentity(product, name, baseUnit, presentations));
        if (duplicate) {
            throw new BusinessException("DUPLICATE_PRODUCT", "Ya existe un producto con la misma presentación.",
                    ErrorCategory.CONFLICT);
        }
    }

    private boolean sameProductIdentity(ProductCatalogPersistencePort.CatalogProduct product, String name,
                                        String baseUnit, List<ProductCatalogPersistencePort.NewPresentation> presentations) {
        Set<String> presentationCodes = presentations.stream().map(ProductCatalogPersistencePort.NewPresentation::code)
                .collect(Collectors.toSet());
        return product.name().trim().equalsIgnoreCase(name.trim())
                && product.baseUnitCode().equalsIgnoreCase(baseUnit)
                && product.presentations().size() == presentationCodes.size()
                && product.presentations().stream().map(ProductCatalogPersistencePort.CatalogPresentation::code)
                .collect(Collectors.toSet()).equals(presentationCodes);
    }

    private ProductResponse toResponse(ProductCatalogPersistencePort.CatalogProduct product) {
        var presentations = product.presentations().stream()
                .map(item -> new ProductResponse.PresentationResponse(item.id(), item.code(), item.name(),
                        item.unitCode(), item.conversionFactor(), item.active()))
                .toList();
        return new ProductResponse(product.id(), product.code(), product.name(), product.description(),
                product.baseUnitCode(), product.active(), product.controlsInventory(), presentations);
    }

    private String normalizeCode(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
