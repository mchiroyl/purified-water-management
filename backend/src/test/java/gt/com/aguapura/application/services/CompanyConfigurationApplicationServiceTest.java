package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.company.CompanyConfigurationRequest;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CompanyConfigurationApplicationServiceTest {

    private final FakeCompanyPersistence repository = new FakeCompanyPersistence();
    private final CompanyConfigurationApplicationService service = new CompanyConfigurationApplicationService(repository);

    @Test
    void createsTheSingleCompanyConfigurationAndNormalizesCodes() {
        var result = service.upsert(validRequest("gtq", "v"));

        assertThat(result.commercialName()).isEqualTo("Agua Pura");
        assertThat(result.currencyCode()).isEqualTo("GTQ");
        assertThat(result.receiptPrefix()).isEqualTo("V");
        assertThat(result.nextReceiptNumber()).isEqualTo(25);
        assertThat(repository.saved).isNotNull();
    }

    @Test
    void rejectsUnknownTimezone() {
        assertThatThrownBy(() -> service.upsert(new CompanyConfigurationRequest(
                "Agua Pura", "Agua Pura, S.A.", "1234-5", "Ciudad de Guatemala",
                "", "", "", "GTQ", "Mars/Olympus", "V", 25, "")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("La zona horaria no es válida.");
    }

    private CompanyConfigurationRequest validRequest(String currency, String prefix) {
        return new CompanyConfigurationRequest("Agua Pura", "Agua Pura, S.A.", "1234-5",
                "Ciudad de Guatemala", "", "", "", currency.toUpperCase(),
                "America/Guatemala", prefix, 25, "Comprobante interno");
    }

    private static final class FakeCompanyPersistence implements CompanyConfigurationPersistencePort {
        private CompanyData saved;

        @Override
        public Optional<CompanyData> find() {
            return Optional.ofNullable(saved);
        }

        @Override
        public CompanyData save(CompanyData data) {
            saved = new CompanyData(data.id(), data.commercialName(), data.legalName(), data.taxId(), data.address(),
                    data.phone(), data.whatsapp(), data.email(), data.currencyCode(), data.timezone(),
                    data.receiptPrefix(), data.nextReceiptNumber(), data.logoFileId(), data.documentLegend(), data.version());
            return saved;
        }
    }
}
