package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ProvisionalCustomerPort {
    boolean sellerAssignedToRoute(UUID userId, UUID routeId);

    CustomerView create(NewCustomer customer);

    List<ReviewView> findPendingReviews();

    CustomerView decide(RegistrationDecision decision);

    record NewCustomer(UUID id, UUID routeId, String code, String name, String normalizedName,
                       String phone, String normalizedPhone, String whatsapp, String normalizedWhatsapp,
                       String addressReference, String customerType, String registrationState,
                       UUID createdBy, UUID sourceDeviceId) {
    }

    record CustomerView(UUID id, String code, String name, String contactName, String phone, String whatsapp,
                        String addressReference, String customerType, String status, boolean creditAllowed,
                        BigDecimal creditLimit, BigDecimal currentBalance, UUID routeId, String routeCode,
                        String routeName, UUID sellerId, String sellerName, String registrationState,
                        Instant createdAt) {
    }

    record DuplicateCandidate(UUID id, String code, String name, String phone, String whatsapp) {
    }

    record ReviewView(CustomerView customer, List<DuplicateCandidate> duplicateCandidates) {
    }

    record RegistrationDecision(UUID customerId, String decision, UUID targetCustomerId, String reason,
                                UUID reviewedBy) {
    }
}
