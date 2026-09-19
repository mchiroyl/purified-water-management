package gt.com.aguapura.infrastructure.documents;

import gt.com.aguapura.application.ports.CreditPaymentVoucherPdfPort;
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
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Component
public class PdfBoxCreditVoucherGenerator implements CreditPaymentVoucherPdfPort {
    private static final float MARGIN = 42;
    private static final Color TEAL = new Color(0, 118, 128);
    private static final Color DARK = new Color(21, 52, 59);
    private static final Color LIGHT = new Color(229, 246, 247);
    private static final Color GRAY_BG = new Color(245, 247, 248);
    private static final Color BORDER_GRAY = new Color(210, 220, 224);
    private static final PDFont REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDFont BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss", Locale.forLanguageTag("es-GT"))
                    .withZone(ZoneId.of("America/Guatemala"));

    @Override
    public byte[] generate(VoucherData data) {
        try (var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.LETTER);
            document.addPage(page);

            try (var cs = new PDPageContentStream(document, page)) {
                float pageWidth = page.getMediaBox().getWidth();
                float pageHeight = page.getMediaBox().getHeight();
                float y = pageHeight - MARGIN;
                float contentWidth = pageWidth - (2 * MARGIN);

                // Header / Logo
                float headerX = MARGIN;
                if (data.companyLogo() != null && data.companyLogo().length > 0) {
                    try {
                        var image = PDImageXObject.createFromByteArray(document, data.companyLogo(), "company-logo");
                        float scale = Math.min(80f / image.getWidth(), 55f / image.getHeight());
                        float imgW = image.getWidth() * scale;
                        float imgH = image.getHeight() * scale;
                        cs.drawImage(image, MARGIN, y - imgH + 5, imgW, imgH);
                        headerX = MARGIN + imgW + 16;
                    } catch (Exception ignored) {
                    }
                }

                // Company info
                drawText(cs, data.companyName(), BOLD, 16, DARK, headerX, y);
                y -= 18;
                if (data.companyLegalName() != null && !data.companyLegalName().isEmpty()) {
                    drawText(cs, data.companyLegalName(), REGULAR, 10, DARK, headerX, y);
                    y -= 14;
                }
                drawText(cs, "NIT: " + data.companyTaxId(), REGULAR, 9, DARK, headerX, y);
                y -= 13;
                drawText(cs, data.companyAddress(), REGULAR, 9, DARK, headerX, y);
                y -= 13;
                String contacts = "";
                if (data.companyPhone() != null && !data.companyPhone().isEmpty()) contacts += "Tel: " + data.companyPhone();
                if (data.companyWhatsapp() != null && !data.companyWhatsapp().isEmpty()) {
                    if (!contacts.isEmpty()) contacts += "  |  ";
                    contacts += "WhatsApp: " + data.companyWhatsapp();
                }
                if (!contacts.isEmpty()) {
                    drawText(cs, contacts, REGULAR, 9, DARK, headerX, y);
                    y -= 14;
                }

                y -= 15;

                // Title banner
                float bannerHeight = 36;
                fillRect(cs, LIGHT, MARGIN, y - bannerHeight, contentWidth, bannerHeight);
                strokeRect(cs, TEAL, 1.5f, MARGIN, y - bannerHeight, contentWidth, bannerHeight);

                drawText(cs, "COMPROBANTE DE ABONO A CRÉDITO", BOLD, 13, TEAL, MARGIN + 14, y - 22);
                String voucherNumText = data.voucherNumber();
                float vNumWidth = BOLD.getStringWidth(voucherNumText) / 1000f * 13;
                drawText(cs, voucherNumText, BOLD, 13, DARK, MARGIN + contentWidth - vNumWidth - 14, y - 22);

                y -= (bannerHeight + 20);

                // Date & Status row
                String formattedDate = DATE_FORMATTER.format(data.paymentDate());
                drawText(cs, "Fecha de registro: " + formattedDate, REGULAR, 10, DARK, MARGIN, y);
                String statusLabel = switch (data.status()) {
                    case "CONFIRMED" -> "CONFIRMADO (EFECTIVO)";
                    case "VERIFIED" -> "VERIFICADO (TRANSFERENCIA)";
                    case "PENDING_VERIFICATION" -> "PENDIENTE DE VERIFICACIÓN";
                    case "REJECTED" -> "RECHAZADO";
                    default -> data.status();
                };
                float statusWidth = BOLD.getStringWidth("Estado: " + statusLabel) / 1000f * 10;
                drawText(cs, "Estado: " + statusLabel, BOLD, 10, "REJECTED".equals(data.status()) ? Color.RED : TEAL,
                        MARGIN + contentWidth - statusWidth, y);

                y -= 25;

                // Customer Box
                float custBoxHeight = 52;
                fillRect(cs, GRAY_BG, MARGIN, y - custBoxHeight, contentWidth, custBoxHeight);
                strokeRect(cs, BORDER_GRAY, 1f, MARGIN, y - custBoxHeight, contentWidth, custBoxHeight);

                drawText(cs, "DATOS DEL CLIENTE", BOLD, 9, TEAL, MARGIN + 12, y - 16);
                drawText(cs, "Cliente: " + data.customerName(), BOLD, 11, DARK, MARGIN + 12, y - 32);
                drawText(cs, "Código: " + data.customerCode(), REGULAR, 10, DARK, MARGIN + 12, y - 46);

                y -= (custBoxHeight + 20);

                // Payment Details Box
                float detailsHeight = 110;
                if ("Transferencia bancaria".equals(data.paymentMethod())) {
                    detailsHeight += 30;
                }
                fillRect(cs, Color.WHITE, MARGIN, y - detailsHeight, contentWidth, detailsHeight);
                strokeRect(cs, BORDER_GRAY, 1f, MARGIN, y - detailsHeight, contentWidth, detailsHeight);

                float detailY = y - 20;
                drawText(cs, "DETALLE DEL PAGO", BOLD, 10, TEAL, MARGIN + 12, detailY);
                detailY -= 22;

                drawText(cs, "Método de Pago:", REGULAR, 10, DARK, MARGIN + 12, detailY);
                drawText(cs, data.paymentMethod(), BOLD, 10, DARK, MARGIN + 160, detailY);
                detailY -= 18;

                if ("Transferencia bancaria".equals(data.paymentMethod())) {
                    drawText(cs, "No. Referencia:", REGULAR, 10, DARK, MARGIN + 12, detailY);
                    drawText(cs, data.reference().isEmpty() ? "N/A" : data.reference(), BOLD, 10, DARK, MARGIN + 160, detailY);
                    detailY -= 18;

                    if (!data.bank().isEmpty()) {
                        drawText(cs, "Banco:", REGULAR, 10, DARK, MARGIN + 12, detailY);
                        drawText(cs, data.bank(), REGULAR, 10, DARK, MARGIN + 160, detailY);
                        detailY -= 18;
                    }
                }

                drawText(cs, "Cobrado por:", REGULAR, 10, DARK, MARGIN + 12, detailY);
                drawText(cs, data.collectedByName(), REGULAR, 10, DARK, MARGIN + 160, detailY);
                detailY -= 24;

                // Monto abonado destacable
                fillRect(cs, LIGHT, MARGIN + 10, detailY - 10, contentWidth - 20, 32);
                strokeRect(cs, TEAL, 1f, MARGIN + 10, detailY - 10, contentWidth - 20, 32);
                drawText(cs, "MONTO ABONADO:", BOLD, 12, DARK, MARGIN + 20, detailY + 2);
                String formattedAmount = "Q " + data.amount().setScale(2, RoundingMode.HALF_UP).toString();
                float amountWidth = BOLD.getStringWidth(formattedAmount) / 1000f * 14;
                drawText(cs, formattedAmount, BOLD, 14, TEAL, MARGIN + contentWidth - amountWidth - 25, detailY + 2);

                y -= (detailsHeight + 30);

                if (data.notes() != null && !data.notes().isEmpty()) {
                    drawText(cs, "Notas: " + data.notes(), REGULAR, 9, DARK, MARGIN, y);
                    y -= 20;
                }

                y -= 30;

                // Signatures / Disclaimers
                cs.setStrokingColor(BORDER_GRAY);
                cs.setLineWidth(1f);
                float sigWidth = 180;
                cs.moveTo(MARGIN + 30, y);
                cs.lineTo(MARGIN + 30 + sigWidth, y);
                cs.stroke();

                cs.moveTo(MARGIN + contentWidth - sigWidth - 30, y);
                cs.lineTo(MARGIN + contentWidth - 30, y);
                cs.stroke();

                drawText(cs, "Firma del Cobrador", REGULAR, 9, DARK, MARGIN + 60, y - 14);
                drawText(cs, "Firma del Cliente", REGULAR, 9, DARK, MARGIN + contentWidth - sigWidth + 15, y - 14);

                y -= 50;

                // Footer legend
                String legend = "Este documento es un comprobante de abono al crédito. No representa una factura ni sustituye documentos tributarios.";
                float legendWidth = REGULAR.getStringWidth(legend) / 1000f * 8;
                drawText(cs, legend, REGULAR, 8, Color.GRAY, (pageWidth - legendWidth) / 2f, y);
            }

            document.save(output);
            return output.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("VOUCHER_PDF_ERROR", "Error generando el comprobante de abono PDF: " + e.getMessage(), ErrorCategory.INTERNAL);
        }
    }

    private void drawText(PDPageContentStream cs, String text, PDFont font, float fontSize, Color color, float x, float y) throws IOException {
        if (text == null || text.isEmpty()) return;
        cs.beginText();
        cs.setFont(font, fontSize);
        cs.setNonStrokingColor(color);
        cs.newLineAtOffset(x, y);
        cs.showText(text);
        cs.endText();
    }

    private void fillRect(PDPageContentStream cs, Color color, float x, float y, float width, float height) throws IOException {
        cs.setNonStrokingColor(color);
        cs.addRect(x, y, width, height);
        cs.fill();
    }

    private void strokeRect(PDPageContentStream cs, Color color, float lineWidth, float x, float y, float width, float height) throws IOException {
        cs.setStrokingColor(color);
        cs.setLineWidth(lineWidth);
        cs.addRect(x, y, width, height);
        cs.stroke();
    }
}
