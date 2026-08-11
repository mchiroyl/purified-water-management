package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public interface ReceiptPdfPort {
    byte[] generate(ReceiptData receipt);

    record ReceiptData(
            String commercialName,
            String legalName,
            String taxId,
            String address,
            String phone,
            String whatsapp,
            String email,
            String currencyCode,
            String timezone,
            String documentLegend,
            byte[] logo,
            String logoMediaType,
            String documentNumber,
            Instant saleDate,
            String customerName,
            String sellerName,
            String status,
            BigDecimal subtotal,
            BigDecimal total,
            List<Item> items,
            List<Payment> payments
    ) {
        public ReceiptData {
            items = List.copyOf(items);
            payments = List.copyOf(payments);
            logo = logo == null ? null : logo.clone();
        }
    }

    record Item(String productName, String presentationName, BigDecimal quantity,
                BigDecimal unitPrice, BigDecimal lineTotal, String priceSource) {
    }

    record Payment(String method, BigDecimal amount, String status) {
    }
}
