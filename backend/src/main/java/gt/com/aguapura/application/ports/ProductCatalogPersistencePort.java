package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductCatalogPersistencePort {

    boolean unitExists(String code);

    boolean productCodeExists(String code);

    String nextProductCode();

    String nextPresentationCode();

    CatalogPresentationTemplate createPresentationTemplate(NewPresentationTemplate presentation);

    CatalogPresentationTemplate updatePresentationTemplate(UUID id, NewPresentationTemplate presentation);

    CatalogPresentationTemplate setPresentationTemplateActive(UUID id, boolean active);

    void deletePresentationTemplate(UUID id);

    List<CatalogPresentationTemplate> findPresentationTemplates(String query);

    List<CatalogPresentationTemplate> findPresentationTemplatesByIds(List<UUID> ids);

    CatalogProduct create(NewProduct product);

    List<CatalogProduct> findAll();

    Optional<CatalogProduct> findById(UUID id);

    CatalogProduct setActive(UUID id, boolean active);

    CatalogProduct updateProduct(UUID id, String name, String description, String baseUnitCode, boolean controlsInventory);

    void deleteProduct(UUID id);

    CatalogProduct updateConversion(UUID productId, UUID presentationId, BigDecimal factor);

    CatalogProduct setPresentationActive(UUID productId, UUID presentationId, boolean active);

    record NewProduct(String code, String name, String description, String baseUnitCode,
                      boolean controlsInventory, List<NewPresentation> presentations) {
    }

    record NewPresentation(String code, String name, String unitCode, BigDecimal conversionFactor) {
    }

    record NewPresentationTemplate(String code, String name, String presentationType, BigDecimal contentQuantity,
                                   String contentUnit, String unitCode, BigDecimal conversionFactor) {
    }

    record CatalogPresentationTemplate(UUID id, String code, String name, String presentationType,
                                       BigDecimal contentQuantity, String contentUnit, String unitCode,
                                       BigDecimal conversionFactor, boolean active) {
    }

    record CatalogProduct(UUID id, String code, String name, String description, String baseUnitCode,
                          boolean active, boolean controlsInventory, List<CatalogPresentation> presentations) {
    }

    record CatalogPresentation(UUID id, String code, String name, String unitCode,
                               BigDecimal conversionFactor, boolean active) {
    }
}
