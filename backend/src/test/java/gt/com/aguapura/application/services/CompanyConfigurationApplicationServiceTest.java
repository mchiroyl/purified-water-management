package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.company.CompanyConfigurationRequest;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.infrastructure.database.entities.CompanyConfigurationJpaEntity;
import gt.com.aguapura.infrastructure.repositories.CompanyConfigurationJpaRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CompanyConfigurationApplicationServiceTest {

    private final CompanyConfigurationJpaRepository repository = mock(CompanyConfigurationJpaRepository.class);
    private final CompanyConfigurationApplicationService service = new CompanyConfigurationApplicationService(repository);

    @Test
    void createsTheSingleCompanyConfigurationAndNormalizesCodes() {
        when(repository.findBySingletonKeyTrue()).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.upsert(validRequest("gtq", "v"));

        assertThat(result.commercialName()).isEqualTo("Agua Pura");
        assertThat(result.currencyCode()).isEqualTo("GTQ");
        assertThat(result.receiptPrefix()).isEqualTo("V");
        verify(repository).save(any(CompanyConfigurationJpaEntity.class));
    }

    @Test
    void rejectsUnknownTimezone() {
        assertThatThrownBy(() -> service.upsert(new CompanyConfigurationRequest(
                "Agua Pura", "Agua Pura, S.A.", "1234-5", "Ciudad de Guatemala",
                "", "", "", "GTQ", "Mars/Olympus", "V", "")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("La zona horaria no es válida.");
    }

    private CompanyConfigurationRequest validRequest(String currency, String prefix) {
        return new CompanyConfigurationRequest("Agua Pura", "Agua Pura, S.A.", "1234-5",
                "Ciudad de Guatemala", "", "", "", currency.toUpperCase(),
                "America/Guatemala", prefix, "Comprobante interno");
    }
}
