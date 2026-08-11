package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.sync.SyncBatchRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationResult;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class SyncBatchApplicationService {
    private final SyncOperationApplicationService operations;

    public SyncBatchApplicationService(SyncOperationApplicationService operations) {
        this.operations = operations;
    }

    public List<SyncOperationResult> process(SyncBatchRequest request, UUID actorId, UUID deviceId,
                                             boolean restrictedToSeller) {
        var results = new ArrayList<SyncOperationResult>();
        for (var operation : request.operations()) {
            try {
                results.add(operations.process(operation, actorId, deviceId, restrictedToSeller));
            } catch (BusinessException exception) {
                String status = exception.category() == ErrorCategory.CONFLICT ? "CONFLICT" : "REJECTED";
                results.add(operations.recordFailure(operation, actorId, deviceId, status, exception.code(),
                        exception.getMessage()));
            } catch (RuntimeException exception) {
                results.add(operations.recordFailure(operation, actorId, deviceId, "RETRY",
                        "SYNC_OPERATION_TEMPORARILY_UNAVAILABLE",
                        "La operación no pudo procesarse en este momento."));
            }
        }
        return results;
    }
}
