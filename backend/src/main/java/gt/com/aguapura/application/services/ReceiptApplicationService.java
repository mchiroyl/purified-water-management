package gt.com.aguapura.application.services;

import gt.com.aguapura.application.ports.ReceiptDocumentPort;
import gt.com.aguapura.application.ports.ReceiptPdfPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class ReceiptApplicationService {
    private final ReceiptDocumentPort documents;
    private final ReceiptPdfPort pdf;

    public ReceiptApplicationService(ReceiptDocumentPort documents, ReceiptPdfPort pdf) {
        this.documents = documents;
        this.pdf = pdf;
    }

    @Transactional
    public ReceiptDocumentPort.StoredReceipt getOrGenerate(UUID saleId, UUID actorId, UUID deviceId,
                                                           boolean restrictedToSeller) {
        Optional<UUID> seller = restrictedToSeller ? Optional.of(actorId) : Optional.empty();
        var existing = documents.find(saleId, seller);
        if (existing.isPresent()) return existing.get();
        var source = documents.loadSource(saleId, seller);
        existing = documents.find(saleId, seller);
        if (existing.isPresent()) return existing.get();
        var content = pdf.generate(source);
        return documents.store(saleId, source.documentNumber(), content, actorId, deviceId);
    }
}
