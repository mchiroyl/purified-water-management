package gt.com.aguapura.infrastructure.documents;

import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.application.ports.CompanyLogoPort;
import org.apache.pdfbox.Loader;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ReportDocumentGeneratorTest {

    @Test
    void embedsTheConfiguredLogoInExcelAndPdfReports() throws Exception {
        byte[] logo = java.util.Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        var logoPort = new CompanyLogoPort() {
            @Override
            public LogoFile save(NewLogo value) { throw new UnsupportedOperationException(); }

            @Override
            public Optional<LogoFile> find() {
                return Optional.of(new LogoFile(UUID.randomUUID(), "image/png", logo));
            }
        };
        var generator = new ReportDocumentGenerator(logoPort);
        var company = new CompanyConfigurationPersistencePort.CompanyData(
                UUID.randomUUID(), "Agua Clara", "Purificadora Agua Clara, S.A.", "1234567-8",
                "Zona 1, Guatemala", "2222-2222", "5555-5555", "ventas@agua.gt", "GTQ",
                "America/Guatemala", "V", 42, UUID.randomUUID(), "Gracias por su compra", 1);

        byte[] excel = generator.excel("Ventas", company, "Sin filtros", List.of("Documento"),
                List.of(List.of("V-00000042")));
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(excel))) {
            assertThat(workbook.getAllPictures()).hasSize(1);
        }

        byte[] pdf = generator.pdf("Ventas", company, "Sin filtros", List.of("Documento"),
                List.of(List.of("V-00000042")));
        try (var document = Loader.loadPDF(pdf)) {
            assertThat(document.getPage(0).getResources().getXObjectNames())
                    .anyMatch(name -> document.getPage(0).getResources().isImageXObject(name));
        }
    }
}
