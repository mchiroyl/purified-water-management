package gt.com.aguapura.infrastructure.database.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "company_configuration")
public class CompanyConfigurationJpaEntity {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "singleton_key", nullable = false, unique = true)
    private boolean singletonKey = true;

    @Column(name = "commercial_name", nullable = false, length = 150)
    private String commercialName;

    @Column(name = "legal_name", nullable = false, length = 200)
    private String legalName;

    @Column(name = "tax_id", nullable = false, length = 30)
    private String taxId;

    @Column(nullable = false, length = 500)
    private String address;

    @Column(nullable = false, length = 30)
    private String phone;

    @Column(nullable = false, length = 30)
    private String whatsapp;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(nullable = false, length = 80)
    private String timezone;

    @Column(name = "receipt_prefix", nullable = false, length = 20)
    private String receiptPrefix;

    @Column(name = "next_receipt_number", nullable = false)
    private long nextReceiptNumber = 1;

    @Column(name = "document_legend", nullable = false, length = 500)
    private String documentLegend;

    @Version
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CompanyConfigurationJpaEntity() {
    }

    public static CompanyConfigurationJpaEntity create() {
        return new CompanyConfigurationJpaEntity();
    }

    @PrePersist
    void beforeInsert() {
        var now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void beforeUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getCommercialName() { return commercialName; }
    public String getLegalName() { return legalName; }
    public String getTaxId() { return taxId; }
    public String getAddress() { return address; }
    public String getPhone() { return phone; }
    public String getWhatsapp() { return whatsapp; }
    public String getEmail() { return email; }
    public String getCurrencyCode() { return currencyCode; }
    public String getTimezone() { return timezone; }
    public String getReceiptPrefix() { return receiptPrefix; }
    public String getDocumentLegend() { return documentLegend; }
    public long getVersion() { return version; }

    public void update(String commercialName, String legalName, String taxId, String address,
                       String phone, String whatsapp, String email, String currencyCode,
                       String timezone, String receiptPrefix, String documentLegend) {
        this.commercialName = commercialName;
        this.legalName = legalName;
        this.taxId = taxId;
        this.address = address;
        this.phone = phone;
        this.whatsapp = whatsapp;
        this.email = email;
        this.currencyCode = currencyCode.toUpperCase();
        this.timezone = timezone;
        this.receiptPrefix = receiptPrefix.toUpperCase();
        this.documentLegend = documentLegend;
    }
}
