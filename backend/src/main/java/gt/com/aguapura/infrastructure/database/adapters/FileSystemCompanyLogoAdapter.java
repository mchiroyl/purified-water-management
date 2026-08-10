package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.CompanyLogoPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Optional;
import java.util.UUID;

@Repository
public class FileSystemCompanyLogoAdapter implements CompanyLogoPort {
    private final JdbcClient jdbc;
    private final Path root;

    public FileSystemCompanyLogoAdapter(JdbcClient jdbc, @Value("${app.storage.path}") String storagePath) {
        this.jdbc = jdbc;
        this.root = Path.of(storagePath).toAbsolutePath().normalize();
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
        Path target = root.resolve(storageKey).normalize();
        if (!target.startsWith(root)) throw new IllegalStateException("Ruta de almacenamiento inválida");
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, logo.content(), StandardOpenOption.CREATE_NEW);
        } catch (IOException exception) {
            throw new BusinessException("LOGO_STORAGE_ERROR", "No fue posible almacenar el logotipo.", ErrorCategory.INTERNAL);
        }

        var oldId = jdbc.sql("SELECT logo_file_id FROM company_configuration WHERE singleton_key")
                .query(UUID.class).optional().orElse(null);
        int inserted = jdbc.sql("""
                INSERT INTO file_object(id, storage_key, original_name, media_type, size_bytes, sha256, created_by)
                VALUES (:id, :storageKey, :originalName, :mediaType, :sizeBytes, :sha256, :createdBy)
                """).param("id", id).param("storageKey", storageKey).param("originalName", logo.originalName())
                .param("mediaType", logo.mediaType()).param("sizeBytes", logo.content().length)
                .param("sha256", logo.sha256()).param("createdBy", logo.createdBy()).update();
        int changed = jdbc.sql("UPDATE company_configuration SET logo_file_id = :id, updated_at = now(), version = version + 1 WHERE singleton_key")
                .param("id", id).update();
        if (inserted != 1 || changed != 1) {
            try { Files.deleteIfExists(target); } catch (IOException ignored) { }
            throw new BusinessException("COMPANY_CONFIGURATION_REQUIRED",
                    "Guarde primero los datos de la empresa.", ErrorCategory.CONFLICT);
        }
        if (oldId != null) jdbc.sql("UPDATE file_object SET status = 'DELETED' WHERE id = :id").param("id", oldId).update();
        return new LogoFile(id, logo.mediaType(), logo.content());
    }

    @Override
    public Optional<LogoFile> find() {
        return jdbc.sql("""
                SELECT f.id, f.storage_key, f.media_type
                FROM company_configuration c JOIN file_object f ON f.id = c.logo_file_id
                WHERE c.singleton_key AND f.status = 'ACTIVE'
                """).query((rs, rowNum) -> new Stored(rs.getObject("id", UUID.class),
                rs.getString("storage_key"), rs.getString("media_type"))).optional().map(this::read);
    }

    private LogoFile read(Stored stored) {
        Path target = root.resolve(stored.storageKey()).normalize();
        if (!target.startsWith(root)) throw new IllegalStateException("Ruta de almacenamiento inválida");
        try {
            return new LogoFile(stored.id(), stored.mediaType(), Files.readAllBytes(target));
        } catch (IOException exception) {
            throw new BusinessException("LOGO_STORAGE_ERROR", "No fue posible leer el logotipo.", ErrorCategory.INTERNAL);
        }
    }

    private record Stored(UUID id, String storageKey, String mediaType) {}
}
