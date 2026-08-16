package gt.com.aguapura.infrastructure.documents;

import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.application.ports.CompanyLogoPort;
import gt.com.aguapura.application.ports.ReportDocumentPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class ReportDocumentGenerator implements ReportDocumentPort {
    private static final float MARGIN = 34;
    private static final PDFont REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDFont BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private final CompanyLogoPort companyLogo;

    public ReportDocumentGenerator(CompanyLogoPort companyLogo) {
        this.companyLogo = companyLogo;
    }

    @Override
    public byte[] excel(String title, CompanyConfigurationPersistencePort.CompanyData company,
                        String filterSummary, List<String> headers, List<List<String>> rows) {
        try (Workbook workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet(safeSheet(title));
            var logo = currentLogo();
            int titleColumn = logo == null ? 0 : 1;
            int lastColumn = Math.max(titleColumn, headers.size() - 1);
            var titleStyle = style(workbook, true, IndexedColors.DARK_TEAL.getIndex(), IndexedColors.WHITE.getIndex());
            var headerStyle = style(workbook, true, IndexedColors.TEAL.getIndex(), IndexedColors.WHITE.getIndex());
            var textStyle = style(workbook, false, IndexedColors.WHITE.getIndex(), IndexedColors.BLACK.getIndex());
            var row = sheet.createRow(0);
            if (logo != null) row.setHeightInPoints(54);
            var titleCell = row.createCell(titleColumn);
            titleCell.setCellValue(title + " - " + company.commercialName());
            titleCell.setCellStyle(titleStyle);
            mergeIfNeeded(sheet, 0, titleColumn, lastColumn);
            var filterRow = sheet.createRow(1);
            filterRow.createCell(titleColumn).setCellValue("Filtros: " + filterSummary);
            filterRow.getCell(titleColumn).setCellStyle(textStyle);
            mergeIfNeeded(sheet, 1, titleColumn, lastColumn);
            var header = sheet.createRow(3);
            for (int index = 0; index < headers.size(); index++) {
                var cell = header.createCell(index);
                cell.setCellValue(headers.get(index));
                cell.setCellStyle(headerStyle);
            }
            int rowNumber = 4;
            for (List<String> values : rows) {
                var data = sheet.createRow(rowNumber++);
                for (int index = 0; index < headers.size(); index++) {
                    var cell = data.createCell(index);
                    cell.setCellValue(index < values.size() ? safe(values.get(index)) : "");
                    cell.setCellStyle(textStyle);
                }
            }
            sheet.createFreezePane(0, 4);
            for (int index = 0; index < headers.size(); index++) sheet.autoSizeColumn(index, true);
            if (logo != null) embedExcelLogo(sheet, workbook, logo);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException | RuntimeException exception) {
            throw new BusinessException("REPORT_EXCEL_ERROR", "No fue posible generar el archivo Excel.", ErrorCategory.INTERNAL);
        }
    }

    @Override
    public byte[] pdf(String title, CompanyConfigurationPersistencePort.CompanyData company,
                      String filterSummary, List<String> headers, List<List<String>> rows) {
        try (var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            var logo = currentLogo();
            var lines = new ArrayList<String>();
            lines.add(title + " - " + company.commercialName());
            lines.add(company.legalName() + " | NIT: " + company.taxId());
            lines.add(company.address());
            lines.add("Filtros: " + filterSummary);
            lines.add("");
            lines.add(String.join(" | ", headers));
            rows.forEach(values -> lines.add(String.join(" | ", values.stream().map(ReportDocumentGenerator::safe).toList())));
            int lineIndex = 0;
            while (lineIndex < lines.size()) {
                var page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                try (var content = new PDPageContentStream(document, page)) {
                    float y = page.getMediaBox().getHeight() - MARGIN;
                    boolean firstPage = lineIndex == 0;
                    if (firstPage && logo != null) drawPdfLogo(document, content, page, logo);
                    while (lineIndex < lines.size() && y > 46) {
                        String line = ellipsize(lines.get(lineIndex++), REGULAR, 7.5f,
                                page.getMediaBox().getWidth() - MARGIN * 2);
                        float x = firstPage && lineIndex <= 4 ? MARGIN + 88 : MARGIN;
                        drawText(content, line, lineIndex <= 4 ? BOLD : REGULAR,
                                lineIndex <= 4 ? 10 : 7.5f, lineIndex <= 4 ? new Color(0, 118, 128) : Color.DARK_GRAY,
                                x, y);
                        y -= lineIndex == 5 ? 18 : 12;
                    }
                    drawText(content, "Sistema Agua Pura - página " + document.getNumberOfPages(), REGULAR, 7,
                            Color.DARK_GRAY, MARGIN, 25);
                }
            }
            document.save(output);
            return output.toByteArray();
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof BusinessException business) throw business;
            throw new BusinessException("REPORT_PDF_ERROR", "No fue posible generar el archivo PDF.", ErrorCategory.INTERNAL);
        }
    }

    private CompanyLogoPort.LogoFile currentLogo() {
        return companyLogo.find()
                .filter(logo -> logo.content() != null && logo.content().length > 0)
                .orElse(null);
    }

    private void embedExcelLogo(Sheet sheet, Workbook workbook, CompanyLogoPort.LogoFile logo) {
        int pictureType = pictureType(logo);
        if (pictureType < 0) return;
        try {
            int pictureIndex = workbook.addPicture(logo.content(), pictureType);
            var drawing = sheet.createDrawingPatriarch();
            var anchor = workbook.getCreationHelper().createClientAnchor();
            anchor.setCol1(0);
            anchor.setRow1(0);
            anchor.setCol2(1);
            anchor.setRow2(2);
            drawing.createPicture(anchor, pictureIndex);
        } catch (RuntimeException ignored) {
            // Un formato no soportado no debe impedir descargar el reporte.
        }
    }

    private void mergeIfNeeded(Sheet sheet, int row, int fromColumn, int toColumn) {
        if (toColumn > fromColumn) {
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(
                    row, row, fromColumn, toColumn));
        }
    }

    private void drawPdfLogo(PDDocument document, PDPageContentStream content, PDPage page,
                             CompanyLogoPort.LogoFile logo) throws IOException {
        try {
            var image = org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject
                    .createFromByteArray(document, logo.content(), "company-logo");
            float scale = Math.min(76f / image.getWidth(), 52f / image.getHeight());
            content.drawImage(image, MARGIN,
                    page.getMediaBox().getHeight() - MARGIN - image.getHeight() * scale + 6,
                    image.getWidth() * scale, image.getHeight() * scale);
        } catch (IOException | IllegalArgumentException ignored) {
            // El reporte sigue siendo válido cuando el formato del logo no puede incrustarse.
        }
    }

    private int pictureType(CompanyLogoPort.LogoFile logo) {
        String mediaType = logo.mediaType() == null ? "" : logo.mediaType().toLowerCase(Locale.ROOT);
        byte[] content = logo.content();
        if (mediaType.contains("png") || isPng(content)) return Workbook.PICTURE_TYPE_PNG;
        if (mediaType.contains("jpeg") || mediaType.contains("jpg") || isJpeg(content)) {
            return Workbook.PICTURE_TYPE_JPEG;
        }
        return -1;
    }

    private boolean isPng(byte[] content) {
        return content.length >= 8 && content[0] == (byte) 0x89 && content[1] == 0x50
                && content[2] == 0x4E && content[3] == 0x47 && content[4] == 0x0D
                && content[5] == 0x0A && content[6] == 0x1A && content[7] == 0x0A;
    }

    private boolean isJpeg(byte[] content) {
        return content.length >= 3 && (content[0] & 0xFF) == 0xFF
                && (content[1] & 0xFF) == 0xD8 && (content[2] & 0xFF) == 0xFF;
    }

    private CellStyle style(Workbook workbook, boolean bold, short fill, short fontColor) {
        CellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(fill);
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setAlignment(HorizontalAlignment.LEFT);
        Font font = workbook.createFont();
        font.setBold(bold);
        font.setColor(fontColor);
        style.setFont(font);
        return style;
    }

    private static String safe(String value) {
        if (value == null) return "";
        return value.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-');
    }

    private static String safeSheet(String title) {
        String cleaned = title.replaceAll("[\\\\/?*\\[\\]:]", "");
        return cleaned.substring(0, Math.min(31, cleaned.length()));
    }

    private static String ellipsize(String value, PDFont font, float size, float width) throws IOException {
        String result = safe(value);
        while (font.getStringWidth(result) / 1000 * size > width && result.length() > 3) {
            result = result.substring(0, result.length() - 4) + "...";
        }
        return result;
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
}
