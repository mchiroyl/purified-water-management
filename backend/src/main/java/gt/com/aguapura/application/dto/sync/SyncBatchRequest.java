package gt.com.aguapura.application.dto.sync;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SyncBatchRequest(
        @NotEmpty @Size(max = 20) List<@Valid SyncOperationRequest> operations
) {
}
