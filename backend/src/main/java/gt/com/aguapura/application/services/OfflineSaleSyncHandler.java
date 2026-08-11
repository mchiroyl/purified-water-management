package gt.com.aguapura.application.services;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import gt.com.aguapura.application.dto.sales.CreateSaleRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import gt.com.aguapura.application.ports.SyncOperationHandler;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Component;

@Component
public class OfflineSaleSyncHandler implements SyncOperationHandler {
    private final SalesApplicationService sales;
    private final ObjectMapper mapper;

    public OfflineSaleSyncHandler(SalesApplicationService sales, ObjectMapper mapper) {
        this.sales = sales;
        this.mapper = mapper;
    }

    @Override
    public boolean supports(String entityType, String operationType) {
        return "SALE".equals(entityType) && "CREATE".equals(operationType);
    }

    @Override
    public HandlerResult handle(SyncOperationRequest request, SyncActor actor) {
        try {
            var createRequest = mapper.treeToValue(request.payload(), CreateSaleRequest.class);
            var sale = sales.create(createRequest, actor.userId(), actor.deviceId(), actor.restrictedToSeller());
            return new HandlerResult(sale.id(), mapper.valueToTree(sale));
        } catch (JacksonException exception) {
            throw new BusinessException("SYNC_SALE_PAYLOAD_INVALID", "Los datos de la venta local no son válidos.",
                    ErrorCategory.VALIDATION);
        }
    }
}
