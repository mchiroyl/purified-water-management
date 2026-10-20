package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.jugs.JugEventRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class JugEventSyncHandler implements SyncOperationHandler {
    private final JugLoanApplicationService jugs;
    private final SyncPayloadValidator payloads;
    private final AuditApplicationService audit;

    public JugEventSyncHandler(JugLoanApplicationService jugs, SyncPayloadValidator payloads, AuditApplicationService audit) {
        this.jugs = jugs;
        this.payloads = payloads;
        this.audit = audit;
    }

    @Override
    public boolean supports(String entityType, String operationType) {
        return "JUG_EVENT".equals(entityType) && "CREATE".equals(operationType);
    }

    @Override
    public HandlerResult handle(SyncOperationRequest request, SyncActor actor) {
        var eventRequest = payloads.read(request.payload(), JugEventRequest.class,
                "SYNC_JUG_EVENT_PAYLOAD_INVALID", "Los datos del movimiento de garrafones no son válidos.");
        var response = jugs.recordEvent(eventRequest, actor.userId(), actor.deviceId());
        audit.record(actor.userId(), actor.deviceId(), "JUG_LOAN_EVENT", "JUG_LOAN_EVENT", response.id(),
                Map.of(), Map.of(
                        "eventType", response.eventType(),
                        "quantity", response.quantity(),
                        "customerId", response.customerId(),
                        "routeId", response.routeId()
                ));
        return new HandlerResult(response.id(), payloads.tree(response));
    }
}
