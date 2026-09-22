package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.CompanyLogoPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Persists the company logo as binary content (BYTEA) directly in the database.
 * This avoids losing the logo when the server restarts on Render's free tier,
 * which uses ephemeral local storage that is wiped on every restart/sleep cycle.
 */
@Repository
public class FileSystemCompanyLogoAdapter implements CompanyLogoPort {
    private final JdbcClient jdbc;

    public FileSystemCompanyLogoAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public LogoFile save(NewLogo logo) {
        UUID id = UUID.randomUUID();
        String extension = switch (logo.mediaType()) {
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/webp" -> ".webp";
            default -> throw new IllegalArgumentException("Tipo no permitido");
        };
        String storageKey = "company/" + id + extension;

        var oldId = jdbc.sql("SELECT logo_file_id FROM company_configuration WHERE singleton_key")
                .query(UUID.class).optional().orElse(null);

        int inserted = jdbc.sql("""
                INSERT INTO file_object(id, storage_key, original_name, media_type, size_bytes, sha256, created_by, content)
                VALUES (:id, :storageKey, :originalName, :mediaType, :sizeBytes, :sha256, :createdBy, :content)
                """)
                .param("id", id)
                .param("storageKey", storageKey)
                .param("originalName", logo.originalName())
                .param("mediaType", logo.mediaType())
                .param("sizeBytes", logo.content().length)
                .param("sha256", logo.sha256())
                .param("createdBy", logo.createdBy())
                .param("content", logo.content())
                .update();

        int changed = jdbc.sql(
                "UPDATE company_configuration SET logo_file_id = :id, updated_at = now(), version = version + 1 WHERE singleton_key")
                .param("id", id).update();

        if (inserted != 1 || changed != 1) {
            throw new BusinessException("COMPANY_CONFIGURATION_REQUIRED",
                    "Guarde primero los datos de la empresa.", ErrorCategory.CONFLICT);
        }

        if (oldId != null) {
            jdbc.sql("UPDATE file_object SET status = 'DELETED' WHERE id = :id").param("id", oldId).update();
        }

        return new LogoFile(id, logo.mediaType(), logo.content());
    }

    @Override
    public Optional<LogoFile> find() {
        return jdbc.sql("""
                SELECT f.id, f.media_type, f.content
                FROM company_configuration c JOIN file_object f ON f.id = c.logo_file_id
                WHERE c.singleton_key AND f.status = 'ACTIVE' AND f.content IS NOT NULL
                """)
                .query((rs, rowNum) -> new LogoFile(
                        rs.getObject("id", UUID.class),
                        rs.getString("media_type"),
                        rs.getBytes("content")))
                .optional();
    }
}
