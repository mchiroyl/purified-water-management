package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.dto.waste.CreateWasteRequest;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Component;

@Component
public class WasteSyncHandler implements SyncOperationHandler {
    private final WasteApplicationService wastes;
    private final SyncPayloadValidator payloads;

    public WasteSyncHandler(WasteApplicationService wastes, SyncPayloadValidator payloads) {
        this.wastes = wastes;
        this.payloads = payloads;
    }

    @Override
    public boolean supports(String entityType, String operationType) {
        return "WASTE".equals(entityType) && "CREATE".equals(operationType);
    }

    @Override
    public HandlerResult handle(SyncOperationRequest request, SyncActor actor) {
        var payload = payloads.read(request.payload(), CreateWasteRequest.class,
                "SYNC_WASTE_PAYLOAD_INVALID", "Los datos de la merma no son válidos.");
        if (!request.aggregateLocalId().equals(payload.clientReference())) {
            throw new BusinessException("SYNC_WASTE_ID_MISMATCH",
                    "El UUID local de la merma no coincide con la operación.", ErrorCategory.CONFLICT);
        }
        var waste = wastes.create(payload, actor.userId(), actor.deviceId(), actor.restrictedToSeller());
        return new HandlerResult(waste.id(), payloads.tree(waste));
    }
}
