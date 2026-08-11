package gt.com.aguapura.application.services;

import gt.com.aguapura.application.ports.ReceiptDocumentPort;
import gt.com.aguapura.application.ports.ReceiptPdfPort;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReceiptApplicationServiceTest {

    @Test
    void rechecksAfterLockAndReturnsTheDocumentCreatedByAConcurrentRequest() {
        var documents = mock(ReceiptDocumentPort.class);
        var pdf = mock(ReceiptPdfPort.class);
        var saleId = UUID.randomUUID();
        var actorId = UUID.randomUUID();
        var deviceId = UUID.randomUUID();
        var source = mock(ReceiptPdfPort.ReceiptData.class);
        var stored = new ReceiptDocumentPort.StoredReceipt(UUID.randomUUID(), saleId, "V-1",
                "comprobante-V-1.pdf", "application/pdf", "%PDF".getBytes(), Instant.now());
        when(documents.find(saleId, Optional.of(actorId))).thenReturn(Optional.empty(), Optional.of(stored));
        when(documents.loadSource(saleId, Optional.of(actorId))).thenReturn(source);

        var result = new ReceiptApplicationService(documents, pdf)
                .getOrGenerate(saleId, actorId, deviceId, true);

        assertThat(result.id()).isEqualTo(stored.id());
        verify(pdf, never()).generate(source);
        verify(documents, never()).store(saleId, "V-1", "%PDF".getBytes(), actorId, deviceId);
    }
}
