package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.ReceiptDocumentPort;
import gt.com.aguapura.application.ports.ReceiptPdfPort;
import gt.com.aguapura.application.ports.AuditMetadataPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class FileSystemReceiptDocumentAdapter implements ReceiptDocumentPort {
    private final JdbcClient jdbc;
    private final Path root;
    private final AuditMetadataPort auditMetadata;

    public FileSystemReceiptDocumentAdapter(JdbcClient jdbc, @Value("${app.storage.path}") String storagePath,
                                            AuditMetadataPort auditMetadata) {
        this.jdbc = jdbc;
        this.root = Path.of(storagePath).toAbsolutePath().normalize();
        this.auditMetadata = auditMetadata;
    }

    @Override
    public Optional<StoredReceipt> find(UUID saleId, Optional<UUID> sellerUserId) {
        String ownerFilter = sellerUserId.isPresent() ? " AND seller.user_id=:sellerUserId" : "";
        var statement = jdbc.sql("""
                SELECT rd.id,rd.sale_id,rd.document_number,rd.generated_at,f.storage_key,f.original_name,f.media_type
                FROM receipt_document rd JOIN file_object f ON f.id=rd.file_id
                JOIN sale s ON s.id=rd.sale_id JOIN seller ON seller.id=s.seller_id
                WHERE rd.sale_id=:saleId AND f.status='ACTIVE'
                """ + ownerFilter).param("saleId", saleId);
        if (sellerUserId.isPresent()) statement = statement.param("sellerUserId", sellerUserId.get());
        return statement.query((rs, row) -> storedRow(rs)).optional().map(this::loadFile);
    }

    @Override
    public ReceiptPdfPort.ReceiptData loadSource(UUID saleId, Optional<UUID> sellerUserId) {
        String ownerFilter = sellerUserId.isPresent() ? " AND seller.user_id=:sellerUserId" : "";
        var statement = jdbc.sql("""
                SELECT s.id,s.document_number,s.created_at,s.subtotal,s.total,s.currency_code,
                       s.company_name,s.company_legal_name,s.company_tax_id,s.company_address,s.company_phone,
                       s.company_whatsapp,s.company_email,s.company_timezone,s.document_legend,
                       c.name customer_name,seller.display_name seller_name,
                       CASE WHEN EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=s.id AND ar.status='APPROVED')
                            THEN 'ANULADA' ELSE 'CONFIRMADA' END receipt_status,
                       f.storage_key logo_storage_key,f.media_type logo_media_type
                FROM sale s JOIN customer c ON c.id=s.customer_id JOIN seller ON seller.id=s.seller_id
                LEFT JOIN file_object f ON f.id=s.company_logo_file_id
                WHERE s.id=:saleId
                """ + ownerFilter + " FOR UPDATE OF s").param("saleId", saleId);
        if (sellerUserId.isPresent()) statement = statement.param("sellerUserId", sellerUserId.get());
        var source = statement.query((rs, row) -> source(rs)).optional().orElseThrow(this::notFound);
        var items = jdbc.sql("""
                SELECT p.name product_name,pp.name presentation_name,si.presentation_quantity,
                       si.unit_price,si.line_total,si.price_source
                FROM sale_item si JOIN product p ON p.id=si.product_id
                JOIN product_presentation pp ON pp.id=si.presentation_id
                WHERE si.sale_id=:saleId ORDER BY p.name,pp.name
                """).param("saleId", saleId).query((rs, row) -> new ReceiptPdfPort.Item(
                rs.getString("product_name"), rs.getString("presentation_name"),
                rs.getBigDecimal("presentation_quantity"), rs.getBigDecimal("unit_price"),
                rs.getBigDecimal("line_total"), rs.getString("price_source"))).list();
        var payments = jdbc.sql("""
                SELECT payment_method,amount,status FROM payment WHERE sale_id=:saleId
                ORDER BY created_at,payment_method
                """).param("saleId", saleId).query((rs, row) -> new ReceiptPdfPort.Payment(
                rs.getString("payment_method"), rs.getBigDecimal("amount"), rs.getString("status"))).list();
        byte[] logo = source.logoStorageKey() == null ? null : read(root.resolve(source.logoStorageKey()).normalize());
        return new ReceiptPdfPort.ReceiptData(source.commercialName(), source.legalName(), source.taxId(),
                source.address(), source.phone(), source.whatsapp(), source.email(), source.currencyCode(),
                source.timezone(), source.legend(), logo, source.logoMediaType(), source.documentNumber(),
                source.createdAt(), source.customerName(), source.sellerName(), source.status(), source.subtotal(),
                source.total(), items, payments);
    }

    @Override
    public StoredReceipt store(UUID saleId, String documentNumber, byte[] content, UUID actorId, UUID deviceId) {
        UUID fileId = UUID.randomUUID();
        UUID receiptId = UUID.randomUUID();
        String fileName = "comprobante-" + documentNumber.replaceAll("[^A-Za-z0-9_-]", "-") + ".pdf";
        String storageKey = "receipts/" + saleId + "/" + fileId + ".pdf";
        Path target = root.resolve(storageKey).normalize();
        requireInsideRoot(target);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content, StandardOpenOption.CREATE_NEW);
            jdbc.sql("""
                    INSERT INTO file_object(id,storage_key,original_name,media_type,size_bytes,sha256,created_by)
                    VALUES (:id,:key,:name,'application/pdf',:size,:sha,:actor)
                    """).param("id", fileId).param("key", storageKey).param("name", fileName)
                    .param("size", content.length).param("sha", sha256(content)).param("actor", actorId).update();
            jdbc.sql("""
                    INSERT INTO receipt_document(id,sale_id,file_id,document_number,generated_by,generated_device_id)
                    VALUES (:id,:saleId,:fileId,:number,:actor,:device)
                    """).param("id", receiptId).param("saleId", saleId).param("fileId", fileId)
                    .param("number", documentNumber).param("actor", actorId).param("device", deviceId).update();
            jdbc.sql("""
                    INSERT INTO audit_log(user_id,device_id,action,entity_type,entity_id,after_data,correlation_id,ip_address)
                    VALUES (:actor,:device,'RECEIPT_GENERATED','RECEIPT_DOCUMENT',:id,
                            jsonb_build_object('saleId',:saleId,'documentKind','INTERNAL_RECEIPT'),:correlation,:ip)
                    """).param("actor", actorId).param("device", deviceId).param("id", receiptId)
                    .param("saleId", saleId).param("correlation", auditMetadata.current().correlationId())
                    .param("ip", auditMetadata.current().ipAddress()).update();
            return new StoredReceipt(receiptId, saleId, documentNumber, fileName,
                    "application/pdf", content, Instant.now());
        } catch (IOException | RuntimeException exception) {
            try { Files.deleteIfExists(target); } catch (IOException ignored) { }
            if (exception instanceof BusinessException business) throw business;
            throw new BusinessException("RECEIPT_STORAGE_ERROR",
                    "No fue posible almacenar el comprobante.", ErrorCategory.INTERNAL);
        }
    }

    private Stored storedRow(ResultSet rs) throws SQLException {
        return new Stored(rs.getObject("id", UUID.class), rs.getObject("sale_id", UUID.class),
                rs.getString("document_number"), rs.getString("original_name"), rs.getString("media_type"),
                rs.getString("storage_key"), rs.getTimestamp("generated_at").toInstant());
    }

    private StoredReceipt loadFile(Stored item) {
        return new StoredReceipt(item.id(), item.saleId(), item.documentNumber(), item.fileName(), item.mediaType(),
                read(root.resolve(item.storageKey()).normalize()), item.generatedAt());
    }

    private Source source(ResultSet rs) throws SQLException {
        String legalName = rs.getString("company_legal_name");
        if (legalName == null || legalName.isBlank()) legalName = rs.getString("company_name");
        return new Source(rs.getString("document_number"), rs.getTimestamp("created_at").toInstant(),
                rs.getBigDecimal("subtotal"), rs.getBigDecimal("total"), rs.getString("currency_code"),
                rs.getString("company_name"), legalName, rs.getString("company_tax_id"),
                rs.getString("company_address"), rs.getString("company_phone"), rs.getString("company_whatsapp"),
                rs.getString("company_email"), rs.getString("company_timezone"), rs.getString("document_legend"),
                rs.getString("customer_name"), rs.getString("seller_name"), rs.getString("receipt_status"),
                rs.getString("logo_storage_key"), rs.getString("logo_media_type"));
    }

    private byte[] read(Path target) {
        requireInsideRoot(target);
        try {
            return Files.readAllBytes(target);
        } catch (IOException exception) {
            throw new BusinessException("RECEIPT_STORAGE_ERROR",
                    "No fue posible leer el archivo del comprobante.", ErrorCategory.INTERNAL);
        }
    }

    private void requireInsideRoot(Path target) {
        if (!target.startsWith(root)) throw new IllegalStateException("Ruta de almacenamiento inválida");
    }

    private String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private BusinessException notFound() {
        return new BusinessException("RECEIPT_SALE_NOT_FOUND",
                "No se encontró la venta o no pertenece al vendedor.", ErrorCategory.NOT_FOUND);
    }

    private record Stored(UUID id, UUID saleId, String documentNumber, String fileName, String mediaType,
                          String storageKey, Instant generatedAt) { }

    private record Source(String documentNumber, Instant createdAt, BigDecimal subtotal, BigDecimal total,
                          String currencyCode, String commercialName, String legalName, String taxId,
                          String address, String phone, String whatsapp, String email, String timezone, String legend,
                          String customerName, String sellerName, String status, String logoStorageKey,
                          String logoMediaType) { }
}
