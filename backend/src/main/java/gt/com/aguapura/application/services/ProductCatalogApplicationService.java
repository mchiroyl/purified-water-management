package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.catalog.CreateProductRequest;
import gt.com.aguapura.application.dto.catalog.ProductResponse;
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
import java.util.UUID;

@Service
public class ProductCatalogApplicationService {

    private final ProductCatalogPersistencePort persistence;

    public ProductCatalogApplicationService(ProductCatalogPersistencePort persistence) {
        this.persistence = persistence;
    }

    @Transactional
    public ProductResponse create(CreateProductRequest request) {
        String code = normalizeCode(request.code());
        String baseUnit = normalizeCode(request.baseUnitCode());
        if (persistence.productCodeExists(code)) {
            throw new BusinessException("PRODUCT_CODE_EXISTS", "El código de producto ya existe.", ErrorCategory.CONFLICT);
        }
        requireUnit(baseUnit);

        var presentationCodes = new HashSet<String>();
        var presentations = request.presentations().stream().map(item -> {
            String presentationCode = normalizeCode(item.code());
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

        var product = new ProductCatalogPersistencePort.NewProduct(code, request.name().trim(), safe(request.description()),
                baseUnit, request.controlsInventory(), presentations);
        return toResponse(persistence.create(product));
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
