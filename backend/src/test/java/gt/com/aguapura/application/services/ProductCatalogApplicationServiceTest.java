package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.catalog.CreateProductRequest;
import gt.com.aguapura.application.dto.catalog.CreatePresentationTemplateRequest;
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
    void assignsTheNextProductCodeWhenTheClientDoesNotProvideOne() {
        var persistence = new FakeCatalogPersistence();
        var service = new ProductCatalogApplicationService(persistence);
        var request = new CreateProductRequest(null, "Agua pura 600 ml", "",
                "botella", true, null, List.of(
                new CreateProductRequest.PresentationRequest(null, "Fardo x12", "fardo", new BigDecimal("12"))
        ));

        var created = service.create(request);

        assertThat(created.code()).isEqualTo("PRD-0001");
        assertThat(created.baseUnitCode()).isEqualTo("BOTELLA");
        assertThat(created.presentations()).singleElement().satisfies(presentation -> {
            assertThat(presentation.code()).isEqualTo("PRE-0001");
            assertThat(presentation.conversionFactor()).isEqualByComparingTo("12.000000");
        });
    }

    @Test
    void rejectsDuplicatePresentationCodesInSameProduct() {
        var service = new ProductCatalogApplicationService(new FakeCatalogPersistence());
        var request = new CreateProductRequest("AGUA", "Agua", "", "BOTELLA", true, null, List.of(
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
        var product = service.create(new CreateProductRequest("AGUA", "Agua", "", "BOTELLA", true, null, List.of(
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
        var product = service.create(new CreateProductRequest("AGUA", "Agua", "", "BOTELLA", true, null, List.of(
                new CreateProductRequest.PresentationRequest("UNIDAD", "Unidad", "BOTELLA", BigDecimal.ONE)
        )));
        var presentationId = product.presentations().getFirst().id();

        var updated = service.setPresentationActive(product.id(), presentationId, false);

        assertThat(updated.presentations()).singleElement().extracting("active").isEqualTo(false);
        assertThat(updated.presentations().getFirst().id()).isEqualTo(presentationId);
    }

    @Test
    void rejectsTheSameActivePresentationDefinitionTwice() {
        var persistence = new FakeCatalogPersistence();
        var service = new PresentationCatalogApplicationService(persistence);
        var request = new CreatePresentationTemplateRequest(null, "BOTELLA", new BigDecimal("600"),
                "ML", "BOTELLA", BigDecimal.ONE);

        service.create(request);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("DUPLICATE_PRESENTATION");
    }

    private static final class FakeCatalogPersistence implements ProductCatalogPersistencePort {
        private final List<CatalogProduct> products = new ArrayList<>();
        private final List<CatalogPresentationTemplate> presentationTemplates = new ArrayList<>();
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
        public String nextProductCode() {
            return "PRD-%04d".formatted(products.size() + 1);
        }

        @Override
        public String nextPresentationCode() {
            return "PRE-%04d".formatted(products.stream().mapToInt(product -> product.presentations().size()).sum() + 1);
        }

        @Override
        public CatalogPresentationTemplate createPresentationTemplate(NewPresentationTemplate presentation) {
            var created = new CatalogPresentationTemplate(UUID.randomUUID(), presentation.code(), presentation.name(),
                    presentation.presentationType(), presentation.contentQuantity(), presentation.contentUnit(),
                    presentation.unitCode(), presentation.conversionFactor(), true);
            presentationTemplates.add(created);
            return created;
        }

        @Override
        public List<CatalogPresentationTemplate> findPresentationTemplates(String query) {
            return List.copyOf(presentationTemplates);
        }

        @Override
        public List<CatalogPresentationTemplate> findPresentationTemplatesByIds(List<UUID> ids) {
            return List.of();
        }

        @Override
        public CatalogPresentationTemplate updatePresentationTemplate(UUID id, NewPresentationTemplate presentation) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CatalogPresentationTemplate setPresentationTemplateActive(UUID id, boolean active) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deletePresentationTemplate(UUID id) {
            throw new UnsupportedOperationException();
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

        @Override
        public CatalogProduct updateProduct(UUID id, String name, String description, String baseUnitCode, boolean controlsInventory) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteProduct(UUID id) {
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
