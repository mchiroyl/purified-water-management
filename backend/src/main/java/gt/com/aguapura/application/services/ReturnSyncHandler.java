package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.returns.CreateReturnRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Component;

@Component
public class ReturnSyncHandler implements SyncOperationHandler {
    private final ReturnApplicationService returns;
    private final SyncPayloadValidator payloads;

    public ReturnSyncHandler(ReturnApplicationService returns, SyncPayloadValidator payloads) {
        this.returns = returns;
        this.payloads = payloads;
    }

    @Override
    public boolean supports(String entityType, String operationType) {
        return "RETURN".equals(entityType) && "CREATE".equals(operationType);
    }

    @Override
    public HandlerResult handle(SyncOperationRequest request, SyncActor actor) {
        var payload = payloads.read(request.payload(), CreateReturnRequest.class,
                "SYNC_RETURN_PAYLOAD_INVALID", "Los datos de la devolución no son válidos.");
        if (!request.aggregateLocalId().equals(payload.clientReference())) {
            throw new BusinessException("SYNC_RETURN_ID_MISMATCH",
                    "El UUID local de la devolución no coincide con la operación.", ErrorCategory.CONFLICT);
        }
        var item = returns.create(payload, actor.userId(), actor.deviceId(), actor.restrictedToSeller());
        return new HandlerResult(item.id(), payloads.tree(item));
    }
}
