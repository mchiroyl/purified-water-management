package gt.com.aguapura.infrastructure.documents;

import gt.com.aguapura.application.ports.ReceiptPdfPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class PdfBoxReceiptGenerator implements ReceiptPdfPort {
    private static final float MARGIN = 42;
    private static final Color TEAL = new Color(0, 118, 128);
    private static final Color DARK = new Color(21, 52, 59);
    private static final Color LIGHT = new Color(229, 246, 247);
    private static final PDFont REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDFont BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

    @Override
    public byte[] generate(ReceiptData receipt) {
        try (var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            var writer = new Writer(document);
            writer.newPage();
            drawHeader(writer, receipt);
            drawSaleData(writer, receipt);
            drawItems(writer, receipt);
            drawPaymentsAndTotals(writer, receipt);
            drawLegend(writer, receipt.documentLegend());
            writer.close();
            drawFooters(document);
            document.save(output);
            return output.toByteArray();
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof BusinessException business) throw business;
            throw new BusinessException("RECEIPT_PDF_ERROR",
                    "No fue posible generar el comprobante PDF.", ErrorCategory.INTERNAL);
        }
    }

    private void drawHeader(Writer writer, ReceiptData receipt) throws IOException {
        float headerX = receipt.logo() == null || receipt.logo().length == 0 ? MARGIN : MARGIN + 88;
        if (receipt.logo() != null && receipt.logo().length > 0) {
            try {
                var image = PDImageXObject.createFromByteArray(writer.document, receipt.logo(), "company-logo");
                float scale = Math.min(76f / image.getWidth(), 52f / image.getHeight());
                writer.content.drawImage(image, MARGIN, writer.y - image.getHeight() * scale + 6,
                        image.getWidth() * scale, image.getHeight() * scale);
            } catch (IOException | IllegalArgumentException ignored) {
                // El comprobante sigue siendo válido cuando el formato del logo no puede incrustarse.
            }
        }
        writer.text(receipt.commercialName(), BOLD, 19, DARK, headerX, writer.y);
        writer.y -= 20;
        writer.text(receipt.legalName(), REGULAR, 10, DARK, headerX, writer.y);
        writer.y -= 15;
        writer.text("NIT: " + receipt.taxId(), REGULAR, 9, DARK, headerX, writer.y);
        writer.y -= 14;
        writer.text(receipt.address(), REGULAR, 9, DARK, headerX, writer.y);
        writer.y -= 14;
        String contacts = joinPresent("Tel. " + receipt.phone(), "WhatsApp " + receipt.whatsapp(), receipt.email());
        writer.text(contacts, REGULAR, 9, DARK, headerX, writer.y);
        writer.y -= 28;

        writer.fillRect(MARGIN, writer.y - 36, writer.width(), 36, LIGHT);
        writer.text("COMPROBANTE INTERNO", BOLD, 14, TEAL, MARGIN + 12, writer.y - 15);
        writer.text("NO ES DTE FEL CERTIFICADO", BOLD, 9, DARK, MARGIN + 12, writer.y - 29);
        writer.y -= 54;
    }

    private void drawSaleData(Writer writer, ReceiptData receipt) throws IOException {
        writer.sectionTitle("Datos de la venta");
        String date = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", new Locale("es", "GT"))
                .format(receipt.saleDate().atZone(ZoneId.of(receipt.timezone())));
        writer.twoColumns("Número", receipt.documentNumber(), "Fecha", date);
        writer.twoColumns("Cliente", receipt.customerName(), "Vendedor", receipt.sellerName());
        writer.twoColumns("Estado", receipt.status(), "Moneda", receipt.currencyCode());
        writer.y -= 8;
    }

    private void drawItems(Writer writer, ReceiptData receipt) throws IOException {
        writer.sectionTitle("Detalle");
        float[] columns = {MARGIN, MARGIN + 172, MARGIN + 310, MARGIN + 366, MARGIN + 432};
        drawItemTableHeader(writer, columns);
        boolean discounted = false;
        for (var item : receipt.items()) {
            if (writer.ensureSpace(28)) {
                writer.sectionTitle("Detalle - continuación");
                drawItemTableHeader(writer, columns);
            }
            writer.text(ellipsize(item.productName(), REGULAR, 9, 164), REGULAR, 9, DARK, columns[0] + 5, writer.y - 13);
            writer.text(ellipsize(item.presentationName(), REGULAR, 9, 130), REGULAR, 9, DARK, columns[1] + 5, writer.y - 13);
            writer.text(number(item.quantity()), REGULAR, 9, DARK, columns[2] + 5, writer.y - 13);
            writer.text(money(item.unitPrice()), REGULAR, 9, DARK, columns[3] + 5, writer.y - 13);
            writer.text(money(item.lineTotal()), BOLD, 9, DARK, columns[4] + 5, writer.y - 13);
            writer.line(MARGIN, writer.y - 22, MARGIN + writer.width(), writer.y - 22, new Color(210, 226, 228));
            writer.y -= 25;
            discounted |= !"LIST".equals(item.priceSource());
        }
        writer.y -= 4;
        writer.text(discounted ? "Descuentos autorizados: incluidos en los precios aplicados."
                : "Descuentos autorizados: Q0.00", REGULAR, 9, DARK, MARGIN, writer.y);
        writer.y -= 22;
    }

    private void drawItemTableHeader(Writer writer, float[] columns) throws IOException {
        writer.ensureSpace(36);
        writer.fillRect(MARGIN, writer.y - 22, writer.width(), 22, TEAL);
        writer.text("Producto", BOLD, 9, Color.WHITE, columns[0] + 5, writer.y - 15);
        writer.text("Presentación", BOLD, 9, Color.WHITE, columns[1] + 5, writer.y - 15);
        writer.text("Cant.", BOLD, 9, Color.WHITE, columns[2] + 5, writer.y - 15);
        writer.text("Precio", BOLD, 9, Color.WHITE, columns[3] + 5, writer.y - 15);
        writer.text("Total", BOLD, 9, Color.WHITE, columns[4] + 5, writer.y - 15);
        writer.y -= 25;
    }

    private void drawPaymentsAndTotals(Writer writer, ReceiptData receipt) throws IOException {
        writer.sectionTitle("Pago y total");
        for (var payment : receipt.payments()) {
            writer.ensureSpace(18);
            String label = paymentLabel(payment.method()) + " - " + statusLabel(payment.status());
            writer.text(label, BOLD, 9, DARK, MARGIN, writer.y);
            writer.text(money(payment.amount()), REGULAR, 10, DARK, MARGIN + 210, writer.y);
            writer.y -= 18;
        }
        writer.ensureSpace(50);
        writer.line(MARGIN + 290, writer.y, MARGIN + writer.width(), writer.y, TEAL);
        writer.y -= 18;
        writer.text("Subtotal", REGULAR, 10, DARK, MARGIN + 320, writer.y);
        writer.text(money(receipt.subtotal()), REGULAR, 10, DARK, MARGIN + 444, writer.y);
        writer.y -= 21;
        writer.text("TOTAL " + receipt.currencyCode(), BOLD, 13, TEAL, MARGIN + 320, writer.y);
        writer.text(money(receipt.total()), BOLD, 13, TEAL, MARGIN + 438, writer.y);
        writer.y -= 30;
    }

    private void drawLegend(Writer writer, String legend) throws IOException {
        if (legend == null || legend.isBlank()) return;
        writer.sectionTitle("Información adicional");
        for (String line : wrap(legend, REGULAR, 9, writer.width())) {
            writer.ensureSpace(15);
            writer.text(line, REGULAR, 9, DARK, MARGIN, writer.y);
            writer.y -= 13;
        }
    }

    private void drawFooters(PDDocument document) throws IOException {
        int total = document.getNumberOfPages();
        for (int index = 0; index < total; index++) {
            var page = document.getPage(index);
            try (var content = new PDPageContentStream(document, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                content.setStrokingColor(new Color(210, 226, 228));
                content.moveTo(MARGIN, 34);
                content.lineTo(page.getMediaBox().getWidth() - MARGIN, 34);
                content.stroke();
                drawText(content, "Documento digital generado por Sistema Agua Pura", REGULAR, 8, DARK, MARGIN, 20);
                drawText(content, "Página " + (index + 1) + " de " + total, REGULAR, 8, DARK,
                        page.getMediaBox().getWidth() - 92, 20);
            }
        }
    }

    private static String paymentLabel(String method) {
        return switch (method) {
            case "CASH" -> "Efectivo";
            case "TRANSFER" -> "Transferencia";
            case "CREDIT" -> "Crédito";
            default -> method;
        };
    }

    private static String statusLabel(String status) {
        return switch (status) {
            case "CONFIRMED" -> "Confirmado";
            case "VERIFIED" -> "Verificado";
            case "PENDING_VERIFICATION" -> "Pendiente de verificación";
            case "APPLIED" -> "Aplicado";
            case "REJECTED" -> "Rechazado";
            default -> status;
        };
    }

    private static String money(BigDecimal value) {
        return "Q" + value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private static String number(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private static String joinPresent(String... values) {
        var present = new ArrayList<String>();
        for (String value : values) {
            if (value != null && !value.isBlank() && !value.endsWith(" ")) present.add(value);
        }
        return String.join("  |  ", present);
    }

    private static String ellipsize(String value, PDFont font, float size, float width) throws IOException {
        if (font.getStringWidth(safe(value)) / 1000 * size <= width) return safe(value);
        String result = safe(value);
        while (!result.isEmpty() && font.getStringWidth(result + "...") / 1000 * size > width) {
            result = result.substring(0, result.length() - 1);
        }
        return result + "...";
    }

    private static List<String> wrap(String value, PDFont font, float size, float width) throws IOException {
        var result = new ArrayList<String>();
        var line = new StringBuilder();
        for (String word : safe(value).split("\\s+")) {
            String candidate = line.isEmpty() ? word : line + " " + word;
            if (!line.isEmpty() && font.getStringWidth(candidate) / 1000 * size > width) {
                result.add(line.toString());
                line = new StringBuilder(word);
            } else line = new StringBuilder(candidate);
        }
        if (!line.isEmpty()) result.add(line.toString());
        return result;
    }

    private static String safe(String value) {
        if (value == null) return "";
        return value.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-');
    }

    private static void drawText(PDPageContentStream content, String value, PDFont font, float size,
                                 Color color, float x, float y) throws IOException {
        content.beginText();
        content.setNonStrokingColor(color);
        content.setFont(font, size);
        content.newLineAtOffset(x, y);
        content.showText(safe(value));
        content.endText();
    }

    private static final class Writer implements AutoCloseable {
        private final PDDocument document;
        private PDPage page;
        private PDPageContentStream content;
        private float y;

        private Writer(PDDocument document) {
            this.document = document;
        }

        private float width() {
            return page.getMediaBox().getWidth() - MARGIN * 2;
        }

        private void newPage() throws IOException {
            closeContent();
            page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            y = page.getMediaBox().getHeight() - MARGIN;
        }

        private boolean ensureSpace(float required) throws IOException {
            if (y - required < 50) {
                newPage();
                return true;
            }
            return false;
        }

        private void sectionTitle(String title) throws IOException {
            ensureSpace(28);
            text(title, BOLD, 11, TEAL, MARGIN, y);
            line(MARGIN, y - 7, MARGIN + width(), y - 7, TEAL);
            y -= 23;
        }

        private void twoColumns(String leftLabel, String leftValue, String rightLabel, String rightValue) throws IOException {
            ensureSpace(20);
            text(leftLabel, BOLD, 8, DARK, MARGIN, y);
            text(ellipsize(leftValue, REGULAR, 9, 190), REGULAR, 9, DARK, MARGIN + 72, y);
            if (!rightLabel.isBlank()) {
                text(rightLabel, BOLD, 8, DARK, MARGIN + 285, y);
                text(ellipsize(rightValue, REGULAR, 9, 150), REGULAR, 9, DARK, MARGIN + 347, y);
            }
            y -= 18;
        }

        private void text(String value, PDFont font, float size, Color color, float x, float textY) throws IOException {
            drawText(content, value, font, size, color, x, textY);
        }

        private void fillRect(float x, float rectY, float rectWidth, float height, Color color) throws IOException {
            content.setNonStrokingColor(color);
            content.addRect(x, rectY, rectWidth, height);
            content.fill();
        }

        private void line(float x1, float y1, float x2, float y2, Color color) throws IOException {
            content.setStrokingColor(color);
            content.moveTo(x1, y1);
            content.lineTo(x2, y2);
            content.stroke();
        }

        private void closeContent() throws IOException {
            if (content != null) {
                content.close();
                content = null;
            }
        }

        @Override
        public void close() throws IOException {
            closeContent();
        }
    }
}
