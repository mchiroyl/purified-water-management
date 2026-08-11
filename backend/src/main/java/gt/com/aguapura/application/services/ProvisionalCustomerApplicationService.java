package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.customer.CreateOccasionalCustomerRequest;
import gt.com.aguapura.application.dto.customer.DuplicateCandidateResponse;
import gt.com.aguapura.application.dto.customer.ProvisionalReviewResponse;
import gt.com.aguapura.application.dto.customer.RegistrationDecisionRequest;
import gt.com.aguapura.application.dto.customer.SyncProvisionalCustomerRequest;
import gt.com.aguapura.application.dto.route.CustomerResponse;
import gt.com.aguapura.application.ports.ProvisionalCustomerPort;
import gt.com.aguapura.domain.customers.CustomerIdentityNormalizer;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ProvisionalCustomerApplicationService {
    private final ProvisionalCustomerPort persistence;

    public ProvisionalCustomerApplicationService(ProvisionalCustomerPort persistence) {
        this.persistence = persistence;
    }

    @Transactional
    public CustomerResponse createSyncedProvisional(SyncProvisionalCustomerRequest request, UUID actorId,
                                                     UUID deviceId, boolean restrictedToSeller) {
        ensureRouteScope(actorId, request.routeId(), restrictedToSeller);
        validateIdentity(request.name(), request.addressReference());
        return customer(persistence.create(newCustomer(request.localCustomerId(), request.routeId(),
                request.name(), request.phone(), request.whatsapp(), request.addressReference(), "PROVISIONAL",
                "PENDING_REVIEW", actorId, deviceId)));
    }

    @Transactional
    public CustomerResponse createOccasional(CreateOccasionalCustomerRequest request, UUID actorId, UUID deviceId,
                                              boolean restrictedToSeller) {
        ensureRouteScope(actorId, request.routeId(), restrictedToSeller);
        validateIdentity(request.name(), request.addressReference());
        return customer(persistence.create(newCustomer(UUID.randomUUID(), request.routeId(), request.name(),
                request.phone(), request.whatsapp(), request.addressReference(), "OCCASIONAL", "ACTIVE",
                actorId, deviceId)));
    }

    @Transactional(readOnly = true)
    public List<ProvisionalReviewResponse> findPendingReviews() {
        return persistence.findPendingReviews().stream().map(item -> new ProvisionalReviewResponse(
                customer(item.customer()), item.duplicateCandidates().stream().map(candidate ->
                new DuplicateCandidateResponse(candidate.id(), candidate.code(), candidate.name(),
                        candidate.phone(), candidate.whatsapp())).toList())).toList();
    }

    @Transactional
    public CustomerResponse decideRegistration(UUID customerId, RegistrationDecisionRequest request, UUID actorId) {
        String decision = request.decision() == null ? "" : request.decision().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVED", "REJECTED", "MERGED").contains(decision)) {
            throw validation("INVALID_CUSTOMER_DECISION", "La decisión de registro no es válida.");
        }
        String reason = CustomerIdentityNormalizer.safe(request.reason());
        UUID targetId = request.targetCustomerId();
        if ("MERGED".equals(decision) && (targetId == null || targetId.equals(customerId))) {
            throw validation("INVALID_CUSTOMER_MERGE_TARGET", "Seleccione un cliente permanente diferente.");
        }
        if (!"MERGED".equals(decision) && targetId != null) {
            throw validation("UNEXPECTED_CUSTOMER_MERGE_TARGET", "La decisión no admite cliente de destino.");
        }
        if (Set.of("REJECTED", "MERGED").contains(decision) && reason.isBlank()) {
            throw validation("CUSTOMER_DECISION_REASON_REQUIRED", "Indique el motivo de la decisión.");
        }
        return customer(persistence.decide(new ProvisionalCustomerPort.RegistrationDecision(customerId,
                decision, targetId, reason, actorId)));
    }

    private ProvisionalCustomerPort.NewCustomer newCustomer(UUID id, UUID routeId, String name, String phone,
                                                             String whatsapp, String address, String type,
                                                             String state, UUID actorId, UUID deviceId) {
        String cleanName = CustomerIdentityNormalizer.safe(name);
        String cleanPhone = CustomerIdentityNormalizer.safe(phone);
        String cleanWhatsapp = CustomerIdentityNormalizer.safe(whatsapp);
        String prefix = "PROVISIONAL".equals(type) ? "P-" : "O-";
        return new ProvisionalCustomerPort.NewCustomer(id, routeId, prefix + id, cleanName,
                CustomerIdentityNormalizer.name(cleanName), cleanPhone, CustomerIdentityNormalizer.phone(cleanPhone),
                cleanWhatsapp, CustomerIdentityNormalizer.phone(cleanWhatsapp),
                CustomerIdentityNormalizer.safe(address), type, state, actorId, deviceId);
    }

    private void ensureRouteScope(UUID actorId, UUID routeId, boolean restrictedToSeller) {
        if (restrictedToSeller && !persistence.sellerAssignedToRoute(actorId, routeId)) {
            throw new BusinessException("CUSTOMER_ROUTE_FORBIDDEN",
                    "El vendedor no está asignado a la ruta seleccionada.", ErrorCategory.FORBIDDEN);
        }
    }

    private void validateIdentity(String name, String address) {
        if (CustomerIdentityNormalizer.safe(name).isBlank() || CustomerIdentityNormalizer.safe(name).length() > 180) {
            throw validation("CUSTOMER_NAME_INVALID", "El nombre del cliente no es válido.");
        }
        if (CustomerIdentityNormalizer.safe(address).isBlank()
                || CustomerIdentityNormalizer.safe(address).length() > 1000) {
            throw validation("CUSTOMER_ADDRESS_INVALID", "La referencia del cliente no es válida.");
        }
    }

    private CustomerResponse customer(ProvisionalCustomerPort.CustomerView item) {
        return new CustomerResponse(item.id(), item.code(), item.name(), item.contactName(), item.phone(),
                item.whatsapp(), item.addressReference(), item.customerType(), item.status(), item.creditAllowed(),
                item.creditLimit(), item.currentBalance(), item.routeId(), item.routeCode(), item.routeName(),
                item.sellerId(), item.sellerName(), item.registrationState(), item.createdAt());
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }
}
