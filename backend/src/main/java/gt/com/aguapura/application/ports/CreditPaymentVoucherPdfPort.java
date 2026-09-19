package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;

public interface CreditPaymentVoucherPdfPort {
    byte[] generate(VoucherData data);

    record VoucherData(
            String voucherNumber,
            Instant paymentDate,
            String companyName,
            String companyLegalName,
            String companyTaxId,
            String companyAddress,
            String companyPhone,
            String companyWhatsapp,
            byte[] companyLogo,
            String logoMediaType,
            String currencyCode,
            String customerName,
            String customerCode,
            BigDecimal amount,
            String paymentMethod,
            String reference,
            String bank,
            String collectedByName,
            String status,
            String notes
    ) {
        public VoucherData {
            companyLogo = companyLogo == null ? null : companyLogo.clone();
        }
    }
}
