package gt.com.aguapura.application.services;

import gt.com.aguapura.application.ports.CompanyLogoPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class CompanyLogoApplicationService {
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private final CompanyLogoPort persistence;

    public CompanyLogoApplicationService(CompanyLogoPort persistence) { this.persistence = persistence; }

    @Transactional
    public CompanyLogoPort.LogoFile store(String originalName, String mediaType, byte[] content, UUID actorId) {
        if (content == null || content.length == 0 || content.length > MAX_BYTES) {
            throw validation("INVALID_LOGO_SIZE", "El logotipo debe pesar entre 1 byte y 2 MB.");
        }
        String detected = detect(content);
        if (detected == null || !detected.equals(mediaType)) {
            throw validation("INVALID_LOGO_CONTENT", "El contenido del logotipo no corresponde a una imagen permitida.");
        }
        String safeName = originalName == null ? "logo" : originalName.replaceAll("[^A-Za-z0-9._-]", "_");
        return persistence.save(new CompanyLogoPort.NewLogo(safeName, detected, content, sha256(content), actorId));
    }

    @Transactional(readOnly = true)
    public CompanyLogoPort.LogoFile get() {
        return persistence.find().orElseThrow(() -> new BusinessException("COMPANY_LOGO_NOT_FOUND",
                "La empresa aún no tiene un logotipo.", ErrorCategory.NOT_FOUND));
    }

    private String detect(byte[] bytes) {
        if (starts(bytes, new int[]{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})) return "image/png";
        if (starts(bytes, new int[]{0xff, 0xd8, 0xff})) return "image/jpeg";
        if (bytes.length >= 12 && new String(bytes, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF")
                && new String(bytes, 8, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP")) return "image/webp";
        return null;
    }

    private boolean starts(byte[] bytes, int[] signature) {
        if (bytes.length < signature.length) return false;
        for (int index = 0; index < signature.length; index++) {
            if ((bytes[index] & 0xff) != signature[index]) return false;
        }
        return true;
    }

    private String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }
}
