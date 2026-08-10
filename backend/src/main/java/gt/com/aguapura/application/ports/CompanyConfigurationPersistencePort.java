package gt.com.aguapura.application.ports;

import java.util.Optional;
import java.util.UUID;

public interface CompanyConfigurationPersistencePort {
    Optional<CompanyData> find();
    CompanyData save(CompanyData data);

    record CompanyData(UUID id, String commercialName, String legalName, String taxId, String address,
                       String phone, String whatsapp, String email, String currencyCode, String timezone,
                       String receiptPrefix, String documentLegend, long version) {
    }
}
