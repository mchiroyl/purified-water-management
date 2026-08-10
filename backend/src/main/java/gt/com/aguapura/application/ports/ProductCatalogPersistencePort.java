package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductCatalogPersistencePort {

    boolean unitExists(String code);

    boolean productCodeExists(String code);

    CatalogProduct create(NewProduct product);

    List<CatalogProduct> findAll();

    Optional<CatalogProduct> findById(UUID id);

    CatalogProduct setActive(UUID id, boolean active);

    CatalogProduct updateConversion(UUID productId, UUID presentationId, BigDecimal factor);

    CatalogProduct setPresentationActive(UUID productId, UUID presentationId, boolean active);

    record NewProduct(String code, String name, String description, String baseUnitCode,
                      boolean controlsInventory, List<NewPresentation> presentations) {
    }

    record NewPresentation(String code, String name, String unitCode, BigDecimal conversionFactor) {
    }

    record CatalogProduct(UUID id, String code, String name, String description, String baseUnitCode,
                          boolean active, boolean controlsInventory, List<CatalogPresentation> presentations) {
    }

    record CatalogPresentation(UUID id, String code, String name, String unitCode,
                               BigDecimal conversionFactor, boolean active) {
    }
}
