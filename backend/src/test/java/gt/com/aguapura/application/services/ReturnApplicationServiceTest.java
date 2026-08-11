package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.returns.ConfirmReturnReceiptRequest;
import gt.com.aguapura.application.dto.returns.CreateReturnRequest;
import gt.com.aguapura.application.ports.InventoryPort;
import gt.com.aguapura.application.ports.ReturnPort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ReturnApplicationServiceTest {
    private final FakeReturnPort persistence = new FakeReturnPort();
    private final FakeInventoryPort inventoryPort = new FakeInventoryPort();
    private final ReturnApplicationService service = new ReturnApplicationService(persistence,
            new InventoryApplicationService(inventoryPort));

    @Test
    void reportIsPendingAndDoesNotMoveInventory() {
        var result = service.create(request("UNSOLD_GOOD", null), persistence.reporterId,
                persistence.deviceId, true);

        assertThat(result.returnType()).isEqualTo("UNSOLD_GOOD");
        assertThat(result.status()).isEqualTo("PENDING_RECEIPT");
        assertThat(inventoryPort.movements).isEmpty();
    }

    @Test
    void warehouseReceiptOfUnsoldGoodTransfersOnlyConfirmedQuantity() {
        persistence.current = persistence.view("UNSOLD_GOOD", "PENDING_RECEIPT", BigDecimal.ZERO);
        var response = service.confirmReceipt(persistence.returnId, receipt(new BigDecimal("8")),
                persistence.receiverId, persistence.receiverDeviceId, "BODEGA");

        assertThat(response.status()).isEqualTo("PARTIALLY_RECEIVED");
        assertThat(response.pendingDifferenceBaseUnits()).isEqualByComparingTo("2");
        assertThat(inventoryPort.movements).extracting(InventoryPort.NewMovement::movementType)
                .containsExactly("RETURN_OUT", "RETURN_IN");
    }

    @Test
    void customerReturnIsReceivedIntoWarehouseWithoutMasqueradingAsUnsoldRouteStock() {
        persistence.current = persistence.view("CUSTOMER_RETURN", "PENDING_RECEIPT", BigDecimal.ZERO);
        service.confirmReceipt(persistence.returnId, receipt(new BigDecimal("10")),
                persistence.receiverId, persistence.receiverDeviceId, "BODEGA");

        assertThat(inventoryPort.movements).hasSize(1);
        assertThat(inventoryPort.movements.getFirst().movementType()).isEqualTo("RETURN_IN");
        assertThat(inventoryPort.movements.getFirst().locationId()).isEqualTo(persistence.warehouseId);
    }

    private CreateReturnRequest request(String type, UUID customerId) {
        return new CreateReturnRequest(persistence.returnId, type, persistence.routeId, customerId,
                null, "Producto bueno", Instant.now(), List.of(new CreateReturnRequest.Item(
                persistence.presentationId, new BigDecimal("10"))));
    }

    private ConfirmReturnReceiptRequest receipt(BigDecimal quantity) {
        return new ConfirmReturnReceiptRequest(persistence.warehouseId,
                List.of(new ConfirmReturnReceiptRequest.ItemReceipt(persistence.itemId, quantity)),
                "Conteo físico");
    }

    private static final class FakeReturnPort implements ReturnPort {
        private final UUID returnId = UUID.randomUUID(); private final UUID routeId = UUID.randomUUID();
        private final UUID routeLocationId = UUID.randomUUID(); private final UUID warehouseId = UUID.randomUUID();
        private final UUID sellerId = UUID.randomUUID(); private final UUID reporterId = UUID.randomUUID();
        private final UUID receiverId = UUID.randomUUID(); private final UUID deviceId = UUID.randomUUID();
        private final UUID receiverDeviceId = UUID.randomUUID(); private final UUID presentationId = UUID.randomUUID();
        private final UUID productId = UUID.randomUUID(); private final UUID itemId = UUID.randomUUID();
        private ReturnView current;
        @Override public boolean sellerAssignedToRoute(UUID userId, UUID routeId) { return true; }
        @Override public Optional<RouteContext> findRouteContext(UUID routeId) { return Optional.of(new RouteContext(routeId,"R-1","Ruta",routeLocationId,sellerId,"Vendedor")); }
        @Override public boolean customerBelongsToRoute(UUID customerId, UUID routeId) { return true; }
        @Override public boolean saleBelongsToCustomerAndRoute(UUID saleId, UUID customerId, UUID routeId) { return true; }
        @Override public boolean activeWarehouseExists(UUID locationId) { return warehouseId.equals(locationId); }
        @Override public Optional<PresentationView> findPresentation(UUID id) { return Optional.of(new PresentationView(presentationId,"BOT","Botella",productId,"AGUA","Agua",BigDecimal.ONE)); }
        @Override public ReturnView create(NewReturn item) { current=view(item.returnType(),"PENDING_RECEIPT",BigDecimal.ZERO); return current; }
        @Override public ReturnView findForReceipt(UUID id) { return current; }
        @Override public ReturnView confirmReceipt(NewReceipt item) { current=view(current.returnType(),item.status(),item.items().getFirst().receivedBaseUnits()); return current; }
        @Override public List<ReturnView> findReturns(Optional<UUID> sellerUserId) { return current==null?List.of():List.of(current); }
        private ReturnView view(String type,String status,BigDecimal received) { var item=new ReturnItemView(itemId,returnId,presentationId,"BOT","Botella",productId,"AGUA","Agua",new BigDecimal("10"),new BigDecimal("10"),received); return new ReturnView(returnId,returnId,type,routeId,"R-1","Ruta",routeLocationId,type.equals("CUSTOMER_RETURN")?UUID.randomUUID():null,"C-1","Cliente",null,null,sellerId,"Vendedor",reporterId,"reporter",deviceId,status,"Producto bueno",Instant.now(),Instant.now(),status.equals("PENDING_RECEIPT")?null:warehouseId,status.equals("PENDING_RECEIPT")?null:"Bodega",status.equals("PENDING_RECEIPT")?null:receiverId,status.equals("PENDING_RECEIPT")?null:"receiver",status.equals("PENDING_RECEIPT")?null:receiverDeviceId,status.equals("PENDING_RECEIPT")?null:Instant.now(),status.equals("PENDING_RECEIPT")?"":"Conteo",List.of(item)); }
    }

    private static final class FakeInventoryPort implements InventoryPort {
        private final List<NewMovement> movements=new ArrayList<>();
        @Override public boolean locationCodeExists(String code){return false;} @Override public boolean activeRouteExists(UUID routeId){return true;} @Override public boolean routeLocationExists(UUID routeId){return true;} @Override public boolean activeProductExists(UUID productId){return true;}
        @Override public LocationView createLocation(NewLocation location){throw new UnsupportedOperationException();} @Override public List<LocationView> findLocations(Optional<UUID> sellerUserId){return List.of();}
        @Override public BalanceView lockBalance(UUID locationId,UUID productId){return new BalanceView(locationId,productId,"AGUA","Agua","BOTELLA",new BigDecimal("100"),movements.size(),Instant.now());}
        @Override public MovementView storeMovement(NewMovement movement,long expectedVersion){movements.add(movement);return new MovementView(movement.id(),movement.locationId(),"L","Lugar",movement.productId(),"AGUA","Agua",movement.movementType(),movement.quantityDelta(),movement.balanceBefore(),movement.balanceAfter(),movement.reason(),movement.referenceType(),movement.referenceId(),movement.actorId(),"actor",movement.deviceId(),Instant.now());}
        @Override public List<MovementView> findMovements(UUID locationId,Optional<UUID> sellerUserId){return List.of();}
    }
}
