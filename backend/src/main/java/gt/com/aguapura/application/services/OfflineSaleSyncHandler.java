package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.sales.CreateSaleRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import org.springframework.stereotype.Component;

@Component
public class OfflineSaleSyncHandler implements SyncOperationHandler {
    private final SalesApplicationService sales;
    private final SyncPayloadValidator payloads;

    public OfflineSaleSyncHandler(SalesApplicationService sales, SyncPayloadValidator payloads) {
        this.sales = sales;
        this.payloads = payloads;
    }

    @Override
    public boolean supports(String entityType, String operationType) {
        return "SALE".equals(entityType) && "CREATE".equals(operationType);
    }

    @Override
    public HandlerResult handle(SyncOperationRequest request, SyncActor actor) {
        var createRequest = payloads.read(request.payload(), CreateSaleRequest.class,
                "SYNC_SALE_PAYLOAD_INVALID", "Los datos de la venta local no son válidos.");
        var sale = sales.create(createRequest, actor.userId(), actor.deviceId(), actor.restrictedToSeller());
        return new HandlerResult(sale.id(), payloads.tree(sale));
    }
}
