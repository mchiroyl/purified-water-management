package gt.com.aguapura.application.services;

import gt.com.aguapura.application.ports.CompanyLogoPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CompanyLogoApplicationServiceTest {
    private final FakeLogoPort persistence = new FakeLogoPort();
    private final CompanyLogoApplicationService service = new CompanyLogoApplicationService(persistence);

    @Test
    void storesValidatedPngLogo() {
        byte[] png = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1};
        UUID actor = UUID.randomUUID();

        service.store("marca.png", "image/png", png, actor);

        assertThat(persistence.saved.originalName()).isEqualTo("marca.png");
        assertThat(persistence.saved.createdBy()).isEqualTo(actor);
    }

    @Test
    void rejectsFileWhoseContentDoesNotMatchImageType() {
        assertThatThrownBy(() -> service.store("marca.png", "image/png", "not-png".getBytes(), UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("El contenido del logotipo no corresponde a una imagen permitida.");
    }

    private static final class FakeLogoPort implements CompanyLogoPort {
        private NewLogo saved;
        @Override public LogoFile save(NewLogo logo) { saved = logo; return new LogoFile(UUID.randomUUID(), logo.mediaType(), logo.content()); }
        @Override public Optional<LogoFile> find() { return Optional.empty(); }
    }
}
