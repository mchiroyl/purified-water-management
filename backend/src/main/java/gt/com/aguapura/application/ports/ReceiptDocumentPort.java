package gt.com.aguapura.application.ports;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface ReceiptDocumentPort {
    Optional<StoredReceipt> find(UUID saleId, Optional<UUID> sellerUserId);
    ReceiptPdfPort.ReceiptData loadSource(UUID saleId, Optional<UUID> sellerUserId);
    StoredReceipt store(UUID saleId, String documentNumber, byte[] content, UUID actorId, UUID deviceId);

    record StoredReceipt(UUID id, UUID saleId, String documentNumber, String fileName,
                         String mediaType, byte[] content, Instant generatedAt) {
        public StoredReceipt {
            content = content.clone();
        }
    }
}
