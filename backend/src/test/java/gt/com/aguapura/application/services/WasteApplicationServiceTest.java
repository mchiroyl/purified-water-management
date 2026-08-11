package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.waste.CreateWasteRequest;
import gt.com.aguapura.application.dto.waste.ReviewWasteRequest;
import gt.com.aguapura.application.ports.InventoryPort;
import gt.com.aguapura.application.ports.WastePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WasteApplicationServiceTest {
    private final FakeWastePort persistence = new FakeWastePort();
    private final FakeInventoryPort inventoryPort = new FakeInventoryPort();
    private final WasteApplicationService service = new WasteApplicationService(persistence,
            new InventoryApplicationService(inventoryPort));

    @Test
    void createsPendingWasteUsingDamagedUnitsInsteadOfWholePresentation() {
        var response = service.create(request(new BigDecimal("3"), new BigDecimal("21"), true),
                persistence.reporterId, persistence.deviceId, true);

        assertThat(response.status()).isEqualTo("PENDING_REVIEW");
        assertThat(persistence.created.items().getFirst().reportedBaseUnits()).isEqualByComparingTo("3");
        assertThat(persistence.created.items().getFirst().recoverableBaseUnits()).isEqualByComparingTo("21");
        assertThat(inventoryPort.movements).isEmpty();
    }

    @Test
    void requiresEvidenceAccordingToWasteTypePolicy() {
        assertThatThrownBy(() -> service.create(request(new BigDecimal("3"), new BigDecimal("21"), false),
                persistence.reporterId, persistence.deviceId, true))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("evidencia");
    }

    @Test
    void finalPartialApprovalConsumesOnlyApprovedPhysicalUnits() {
        persistence.current = persistence.view("PENDING_REVIEW", null);
        var result = service.review(persistence.wasteId, new ReviewWasteRequest("APPROVE",
                        List.of(new ReviewWasteRequest.ItemApproval(persistence.itemId, new BigDecimal("2"))),
                        "Daño confirmado"), persistence.reviewerId, persistence.deviceId, "BODEGA");

        assertThat(result.status()).isEqualTo("PARTIALLY_APPROVED");
        assertThat(result.pendingDifferenceBaseUnits()).isEqualByComparingTo("1");
        assertThat(inventoryPort.movements).hasSize(1);
        assertThat(inventoryPort.movements.getFirst().quantityDelta()).isEqualByComparingTo("-2");
        assertThat(inventoryPort.movements.getFirst().referenceType()).isEqualTo("WASTE");
    }

    @Test
    void sellerCannotReviewAndNoFinancialPortExistsInWorkflow() {
        persistence.current = persistence.view("PENDING_REVIEW", null);
        assertThatThrownBy(() -> service.review(persistence.wasteId, new ReviewWasteRequest("APPROVE",
                        List.of(new ReviewWasteRequest.ItemApproval(persistence.itemId, new BigDecimal("3"))),
                        "Intento"), persistence.reviewerId, persistence.deviceId, "VENDEDOR"))
                .isInstanceOf(BusinessException.class);
        assertThat(persistence.reviewed).isNull();
        assertThat(inventoryPort.movements).isEmpty();
    }

    private CreateWasteRequest request(BigDecimal damaged, BigDecimal recoverable, boolean evidence) {
        var evidenceItems = evidence ? List.of(new CreateWasteRequest.Evidence("camera:test", "image/jpeg",
                "a".repeat(64), Instant.now())) : List.<CreateWasteRequest.Evidence>of();
        return new CreateWasteRequest(persistence.wasteId, persistence.routeId, "Fardo dañado",
                Instant.now(), List.of(new CreateWasteRequest.Item(persistence.wasteTypeId,
                persistence.presentationId, BigDecimal.ONE, damaged, recoverable)), evidenceItems);
    }

    private static final class FakeWastePort implements WastePort {
        private final UUID wasteId = UUID.randomUUID();
        private final UUID routeId = UUID.randomUUID();
        private final UUID locationId = UUID.randomUUID();
        private final UUID sellerId = UUID.randomUUID();
        private final UUID reporterId = UUID.randomUUID();
        private final UUID reviewerId = UUID.randomUUID();
        private final UUID deviceId = UUID.randomUUID();
        private final UUID wasteTypeId = UUID.randomUUID();
        private final UUID presentationId = UUID.randomUUID();
        private final UUID productId = UUID.randomUUID();
        private final UUID itemId = UUID.randomUUID();
        private NewWaste created;
        private NewReview reviewed;
        private WasteView current;

        @Override public boolean sellerAssignedToRoute(UUID userId, UUID routeId) { return true; }
        @Override public Optional<RouteContext> findRouteContext(UUID routeId) {
            return Optional.of(new RouteContext(routeId, "R-1", "Ruta 1", locationId, sellerId, "Vendedor"));
        }
        @Override public Optional<PresentationView> findPresentation(UUID id) {
            return Optional.of(new PresentationView(presentationId, "FARDO", "Fardo x24", productId,
                    "AGUA", "Agua", new BigDecimal("24")));
        }
        @Override public Optional<WasteTypeView> findWasteType(UUID id) {
            return Optional.of(new WasteTypeView(wasteTypeId, "ROTURA", "Rotura", "REQUIRED",
                    new BigDecimal("3"), new BigDecimal("10"), 3, true));
        }
        @Override public WasteView create(NewWaste waste) { created = waste; current = view("PENDING_REVIEW", null); return current; }
        @Override public WasteView findForReview(UUID id) { return current; }
        @Override public WasteView review(NewReview review) { reviewed = review; current = view(review.status(), review.requiredRole()); return current; }
        @Override public List<WasteView> findWastes(Optional<UUID> userId) { return current == null ? List.of() : List.of(current); }
        @Override public List<WasteTypeView> findWasteTypes(boolean includeInactive) { return List.of(findWasteType(wasteTypeId).orElseThrow()); }
        @Override public WasteTypeView saveWasteType(WasteTypeDefinition definition) { return findWasteType(wasteTypeId).orElseThrow(); }
        @Override public List<WasteIndicatorView> indicators() { return List.of(); }

        private WasteView view(String status, String requiredRole) {
            var item = new WasteItemView(itemId, wasteId, wasteTypeId, "ROTURA", "Rotura", "REQUIRED",
                    presentationId, "FARDO", "Fardo x24", productId, "AGUA", "Agua",
                    BigDecimal.ONE, new BigDecimal("3"), new BigDecimal("21"),
                    status.equals("PARTIALLY_APPROVED") ? new BigDecimal("2") : BigDecimal.ZERO,
                    new BigDecimal("3"), new BigDecimal("10"));
            return new WasteView(wasteId, wasteId, routeId, "R-1", "Ruta 1", locationId, sellerId,
                    "Vendedor", reporterId, "reporter", deviceId, status, requiredRole, "Fardo dañado",
                    Instant.now(), Instant.now(), List.of(item), List.of(), List.of());
        }
    }

    private static final class FakeInventoryPort implements InventoryPort {
        private final List<NewMovement> movements = new ArrayList<>();
        @Override public boolean locationCodeExists(String code) { return false; }
        @Override public boolean activeRouteExists(UUID routeId) { return true; }
        @Override public boolean routeLocationExists(UUID routeId) { return true; }
        @Override public boolean activeProductExists(UUID productId) { return true; }
        @Override public LocationView createLocation(NewLocation location) { throw new UnsupportedOperationException(); }
        @Override public List<LocationView> findLocations(Optional<UUID> sellerUserId) { return List.of(); }
        @Override public BalanceView lockBalance(UUID locationId, UUID productId) {
            return new BalanceView(locationId, productId, "AGUA", "Agua", "BOTELLA",
                    new BigDecimal("100"), movements.size(), Instant.now());
        }
        @Override public MovementView storeMovement(NewMovement movement, long expectedVersion) {
            movements.add(movement);
            return new MovementView(movement.id(), movement.locationId(), "R-1", "Ruta",
                    movement.productId(), "AGUA", "Agua", movement.movementType(), movement.quantityDelta(),
                    movement.balanceBefore(), movement.balanceAfter(), movement.reason(), movement.referenceType(),
                    movement.referenceId(), movement.actorId(), "actor", movement.deviceId(), Instant.now());
        }
        @Override public List<MovementView> findMovements(UUID locationId, Optional<UUID> sellerUserId) { return List.of(); }
    }
}
