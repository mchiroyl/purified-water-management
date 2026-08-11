package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.customer.SyncProvisionalCustomerRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Component;

@Component
public class ProvisionalCustomerSyncHandler implements SyncOperationHandler {
    private final ProvisionalCustomerApplicationService customers;
    private final SyncPayloadValidator payloads;

    public ProvisionalCustomerSyncHandler(ProvisionalCustomerApplicationService customers,
                                          SyncPayloadValidator payloads) {
        this.customers = customers;
        this.payloads = payloads;
    }

    @Override
    public boolean supports(String entityType, String operationType) {
        return "PROVISIONAL_CUSTOMER".equals(entityType) && "CREATE".equals(operationType);
    }

    @Override
    public HandlerResult handle(SyncOperationRequest request, SyncActor actor) {
        var payload = payloads.read(request.payload(), SyncProvisionalCustomerRequest.class,
                "SYNC_PROVISIONAL_CUSTOMER_PAYLOAD_INVALID", "Los datos del cliente provisional no son válidos.");
        if (!request.aggregateLocalId().equals(payload.localCustomerId())) {
            throw new BusinessException("SYNC_PROVISIONAL_CUSTOMER_ID_MISMATCH",
                    "El UUID local del cliente no coincide con la operación.", ErrorCategory.CONFLICT);
        }
        var customer = customers.createSyncedProvisional(payload, actor.userId(), actor.deviceId(),
                actor.restrictedToSeller());
        return new HandlerResult(customer.id(), payloads.tree(customer));
    }
}
