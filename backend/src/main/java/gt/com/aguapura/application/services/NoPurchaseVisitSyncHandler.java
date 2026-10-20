package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.sales.NoPurchaseVisitRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import org.springframework.stereotype.Component;

@Component
public class NoPurchaseVisitSyncHandler implements SyncOperationHandler {
    private final SalesApplicationService sales;
    private final SyncPayloadValidator payloads;

    public NoPurchaseVisitSyncHandler(SalesApplicationService sales, SyncPayloadValidator payloads) {
        this.sales = sales;
        this.payloads = payloads;
    }

    @Override
    public boolean supports(String entityType, String operationType) {
        return "NO_PURCHASE_VISIT".equals(entityType) && "CREATE".equals(operationType);
    }

    @Override
    public HandlerResult handle(SyncOperationRequest request, SyncActor actor) {
        var visitRequest = payloads.read(request.payload(), NoPurchaseVisitRequest.class,
                "SYNC_NO_PURCHASE_VISIT_PAYLOAD_INVALID", "Los datos de la visita sin compra no son válidos.");
        var response = sales.registerNoPurchaseVisit(visitRequest, actor.userId(), actor.deviceId(), actor.restrictedToSeller());
        return new HandlerResult(response.id(), payloads.tree(response));
    }
}
