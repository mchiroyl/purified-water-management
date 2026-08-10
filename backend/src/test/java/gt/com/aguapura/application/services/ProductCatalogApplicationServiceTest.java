package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.catalog.CreateProductRequest;
import gt.com.aguapura.application.dto.catalog.UpdatePresentationConversionRequest;
import gt.com.aguapura.application.ports.ProductCatalogPersistencePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductCatalogApplicationServiceTest {

    @Test
    void createsProductWithNormalizedCodesAndBaseUnitConversion() {
        var persistence = new FakeCatalogPersistence();
        var service = new ProductCatalogApplicationService(persistence);
        var request = new CreateProductRequest(" agua-600 ", "Agua pura 600 ml", "",
                "botella", true, List.of(
                new CreateProductRequest.PresentationRequest("fardo-12", "Fardo x12", "fardo", new BigDecimal("12"))
        ));

        var created = service.create(request);

        assertThat(created.code()).isEqualTo("AGUA-600");
        assertThat(created.baseUnitCode()).isEqualTo("BOTELLA");
        assertThat(created.presentations()).singleElement().satisfies(presentation -> {
            assertThat(presentation.code()).isEqualTo("FARDO-12");
            assertThat(presentation.conversionFactor()).isEqualByComparingTo("12.000000");
        });
    }

    @Test
    void rejectsDuplicatePresentationCodesInSameProduct() {
        var service = new ProductCatalogApplicationService(new FakeCatalogPersistence());
        var request = new CreateProductRequest("AGUA", "Agua", "", "BOTELLA", true, List.of(
                new CreateProductRequest.PresentationRequest("UNIDAD", "Unidad", "BOTELLA", BigDecimal.ONE),
                new CreateProductRequest.PresentationRequest("unidad", "Unidad repetida", "BOTELLA", BigDecimal.ONE)
        ));

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("DUPLICATE_PRESENTATION_CODE");
    }

    @Test
    void updatesCurrentConversionThroughPersistenceHistoryOperation() {
        var persistence = new FakeCatalogPersistence();
        var service = new ProductCatalogApplicationService(persistence);
        var product = service.create(new CreateProductRequest("AGUA", "Agua", "", "BOTELLA", true, List.of(
                new CreateProductRequest.PresentationRequest("FARDO", "Fardo", "FARDO", new BigDecimal("12"))
        )));

        var updated = service.updateConversion(product.id(), product.presentations().getFirst().id(),
                new UpdatePresentationConversionRequest(new BigDecimal("24")));

        assertThat(updated.presentations()).singleElement()
                .extracting("conversionFactor").isEqualTo(new BigDecimal("24.000000"));
        assertThat(persistence.conversionUpdates).isEqualTo(1);
    }

    @Test
    void deactivatesPresentationWithoutDeletingIt() {
        var persistence = new FakeCatalogPersistence();
        var service = new ProductCatalogApplicationService(persistence);
        var product = service.create(new CreateProductRequest("AGUA", "Agua", "", "BOTELLA", true, List.of(
                new CreateProductRequest.PresentationRequest("UNIDAD", "Unidad", "BOTELLA", BigDecimal.ONE)
        )));
        var presentationId = product.presentations().getFirst().id();

        var updated = service.setPresentationActive(product.id(), presentationId, false);

        assertThat(updated.presentations()).singleElement().extracting("active").isEqualTo(false);
        assertThat(updated.presentations().getFirst().id()).isEqualTo(presentationId);
    }

    private static final class FakeCatalogPersistence implements ProductCatalogPersistencePort {
        private final List<CatalogProduct> products = new ArrayList<>();
        private int conversionUpdates;

        @Override
        public boolean unitExists(String code) {
            return List.of("BOTELLA", "FARDO", "UNIDAD").contains(code);
        }

        @Override
        public boolean productCodeExists(String code) {
            return products.stream().anyMatch(product -> product.code().equals(code));
        }

        @Override
        public CatalogProduct create(NewProduct product) {
            var presentations = product.presentations().stream()
                    .map(item -> new CatalogPresentation(UUID.randomUUID(), item.code(), item.name(), item.unitCode(),
                            item.conversionFactor(), true))
                    .toList();
            var created = new CatalogProduct(UUID.randomUUID(), product.code(), product.name(), product.description(),
                    product.baseUnitCode(), true, product.controlsInventory(), presentations);
            products.add(created);
            return created;
        }

        @Override
        public List<CatalogProduct> findAll() {
            return List.copyOf(products);
        }

        @Override
        public Optional<CatalogProduct> findById(UUID id) {
            return products.stream().filter(product -> product.id().equals(id)).findFirst();
        }

        @Override
        public CatalogProduct setActive(UUID id, boolean active) {
            throw new UnsupportedOperationException();
        }

        public CatalogProduct updateConversion(UUID productId, UUID presentationId, BigDecimal factor) {
            conversionUpdates++;
            var current = findById(productId).orElseThrow();
            var changed = current.presentations().stream().map(item -> item.id().equals(presentationId)
                    ? new CatalogPresentation(item.id(), item.code(), item.name(), item.unitCode(), factor, item.active())
                    : item).toList();
            var updated = new CatalogProduct(current.id(), current.code(), current.name(), current.description(),
                    current.baseUnitCode(), current.active(), current.controlsInventory(), changed);
            products.remove(current);
            products.add(updated);
            return updated;
        }

        public CatalogProduct setPresentationActive(UUID productId, UUID presentationId, boolean active) {
            var current = findById(productId).orElseThrow();
            var changed = current.presentations().stream().map(item -> item.id().equals(presentationId)
                    ? new CatalogPresentation(item.id(), item.code(), item.name(), item.unitCode(),
                    item.conversionFactor(), active) : item).toList();
            var updated = new CatalogProduct(current.id(), current.code(), current.name(), current.description(),
                    current.baseUnitCode(), current.active(), current.controlsInventory(), changed);
            products.remove(current);
            products.add(updated);
            return updated;
        }
    }
}
