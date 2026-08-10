package gt.com.aguapura.application.ports;

import java.util.Optional;
import java.util.UUID;

public interface CompanyLogoPort {
    LogoFile save(NewLogo logo);
    Optional<LogoFile> find();

    record NewLogo(String originalName, String mediaType, byte[] content, String sha256, UUID createdBy) {}
    record LogoFile(UUID id, String mediaType, byte[] content) {}
}
