package gt.com.aguapura.infrastructure.documents;

import gt.com.aguapura.application.ports.ReceiptPdfPort;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PdfBoxReceiptGeneratorTest {

    @Test
    void embedsTheLogoInTheInternalReceipt() throws Exception {
        byte[] logo = Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        var receipt = new ReceiptPdfPort.ReceiptData(
                "Agua Clara", "Purificadora Agua Clara, S.A.", "1234567-8",
                "Zona 1, Guatemala", "2222-2222", "5555-5555", "ventas@agua.gt",
                "GTQ", "America/Guatemala", "Gracias por su compra", logo, "image/png",
                "V-00000042", Instant.parse("2026-08-11T15:30:00Z"), "Cliente Centro",
                "Vendedor Ruta 1", "CONFIRMADA", new BigDecimal("125.00"), new BigDecimal("125.00"),
                List.of(new ReceiptPdfPort.Item("Agua pura", "Fardo x12", new BigDecimal("2"),
                        new BigDecimal("62.50"), new BigDecimal("125.00"), "LIST")),
                List.of(new ReceiptPdfPort.Payment("CASH", new BigDecimal("125.00"), "CONFIRMED"))
        );

        byte[] pdf = new PdfBoxReceiptGenerator().generate(receipt);

        try (var document = Loader.loadPDF(pdf)) {
            assertThat(document.getPage(0).getResources().getXObjectNames())
                    .anyMatch(name -> document.getPage(0).getResources().isImageXObject(name));
        }
    }

    @Test
    void createsAnInternalReceiptWithOfficialSaleAndCompanyData() throws Exception {
        var receipt = new ReceiptPdfPort.ReceiptData(
                "Agua Clara", "Purificadora Agua Clara, S.A.", "1234567-8",
                "Zona 1, Guatemala", "2222-2222", "5555-5555", "ventas@agua.gt",
                "GTQ", "America/Guatemala", "Gracias por su compra", null, null,
                "V-00000042", Instant.parse("2026-08-11T15:30:00Z"), "Cliente Centro",
                "Vendedor Ruta 1", "CONFIRMADA", new BigDecimal("125.00"), new BigDecimal("125.00"),
                List.of(new ReceiptPdfPort.Item("Agua pura", "Fardo x12", new BigDecimal("2"),
                        new BigDecimal("62.50"), new BigDecimal("125.00"), "LIST")),
                List.of(new ReceiptPdfPort.Payment("CASH", new BigDecimal("125.00"), "CONFIRMED"))
        );

        byte[] pdf = new PdfBoxReceiptGenerator().generate(receipt);

        assertThat(pdf).startsWith("%PDF".getBytes());
        try (var document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("COMPROBANTE INTERNO");
            assertThat(text).doesNotContain("FEL", "DTE", "CERTIFICADO");
            assertThat(text).contains("Agua Clara", "Purificadora Agua Clara, S.A.", "1234567-8");
            assertThat(text).contains("V-00000042", "Cliente Centro", "Vendedor Ruta 1");
            assertThat(text).contains("Agua pura", "Fardo x12", "125.00", "Efectivo");
            assertThat(text).contains("Gracias por su compra");
        }
    }
}
