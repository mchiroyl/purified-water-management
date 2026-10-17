package gt.com.aguapura.application.dto.route;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CustomerResponse(
        UUID id, String code, String name, String contactName, String phone, String whatsapp,
        String addressReference, String customerType, String status, boolean creditAllowed,
        BigDecimal creditLimit, BigDecimal currentBalance, UUID routeId, String routeCode,
        String routeName, UUID sellerId, String sellerName, String registrationState, Instant createdAt,
        BigDecimal confirmedLatitude, BigDecimal confirmedLongitude
) {
    public CustomerResponse(
            UUID id, String code, String name, String contactName, String phone, String whatsapp,
            String addressReference, String customerType, String status, boolean creditAllowed,
            BigDecimal creditLimit, BigDecimal currentBalance, UUID routeId, String routeCode,
            String routeName, UUID sellerId, String sellerName, String registrationState, Instant createdAt
    ) {
        this(id, code, name, contactName, phone, whatsapp, addressReference, customerType, status,
                creditAllowed, creditLimit, currentBalance, routeId, routeCode, routeName, sellerId,
                sellerName, registrationState, createdAt, null, null);
    }
}

