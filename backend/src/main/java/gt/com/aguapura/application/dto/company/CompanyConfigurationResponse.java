package gt.com.aguapura.application.dto.company;

import java.util.UUID;

public record CompanyConfigurationResponse(
        UUID id,
        String commercialName,
        String legalName,
        String taxId,
        String address,
        String phone,
        String whatsapp,
        String email,
        String currencyCode,
        String timezone,
        String receiptPrefix,
        long nextReceiptNumber,
        UUID logoFileId,
        String logoUrl,
        String documentLegend,
        long version
) {
}
