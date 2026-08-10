package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.route.*;
import gt.com.aguapura.application.ports.CustomerRoutePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class CustomerRouteApplicationService {
    private final CustomerRoutePort persistence;

    public CustomerRouteApplicationService(CustomerRoutePort persistence) { this.persistence = persistence; }

    @Transactional
    public CustomerResponse createCustomer(CreateCustomerRequest request, UUID actorId) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        String normalizedName = normalizeName(request.name());
        String normalizedPhone = normalizePhone(request.phone());
        String normalizedWhatsapp = normalizePhone(request.whatsapp());
        if (persistence.customerCodeExists(code)) {
            throw conflict("CUSTOMER_CODE_EXISTS", "El código de cliente ya está registrado.");
        }
        if (persistence.hasPotentialDuplicate(normalizedName, normalizedPhone, normalizedWhatsapp)) {
            throw conflict("POTENTIAL_CUSTOMER_DUPLICATE",
                    "Existe un posible cliente duplicado; revise las coincidencias antes de continuar.");
        }
        String type = request.customerType().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PERMANENT", "PROVISIONAL").contains(type)) {
            throw validation("INVALID_CUSTOMER_TYPE", "El tipo de cliente no es válido.");
        }
        boolean creditAllowed = request.creditAllowed() && "PERMANENT".equals(type);
        BigDecimal limit = creditAllowed ? request.creditLimit() : BigDecimal.ZERO;
        var created = persistence.createCustomer(new CustomerRoutePort.NewCustomer(code, request.name().trim(),
                normalizedName, safe(request.contactName()), safe(request.phone()), normalizedPhone,
                safe(request.whatsapp()), normalizedWhatsapp, request.addressReference().trim(), type,
                creditAllowed, limit, actorId));
        return customer(created);
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> findCustomers(UUID userId, boolean restrictedToSeller) {
        Optional<UUID> sellerId = restrictedToSeller ? Optional.of(resolveSeller(userId)) : Optional.empty();
        return persistence.findCustomers(sellerId).stream().map(this::customer).toList();
    }

    @Transactional
    public RouteResponse assignCustomerRoute(UUID customerId, AssignCustomerRouteRequest request, UUID actorId) {
        return route(persistence.assignCustomerRoute(new CustomerRoutePort.NewCustomerRoute(customerId,
                request.routeId(), request.validFrom(), actorId)));
    }

    @Transactional
    public RouteResponse createRoute(CreateRouteRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (persistence.routeCodeExists(code)) throw conflict("ROUTE_CODE_EXISTS", "El código de ruta ya está registrado.");
        return route(persistence.createRoute(new CustomerRoutePort.NewRoute(code, request.name().trim(), safe(request.description()))));
    }

    @Transactional(readOnly = true)
    public List<RouteResponse> findRoutes(UUID userId, boolean restrictedToSeller) {
        Optional<UUID> sellerId = restrictedToSeller ? Optional.of(resolveSeller(userId)) : Optional.empty();
        return persistence.findRoutes(sellerId).stream().map(this::route).toList();
    }

    @Transactional
    public RouteResponse assignRoute(UUID routeId, AssignRouteRequest request, UUID actorId) {
        return route(persistence.assignRoute(new CustomerRoutePort.NewRouteAssignment(routeId,
                request.sellerId(), request.vehicleId(), request.validFrom(), actorId)));
    }

    @Transactional
    public VehicleResponse createVehicle(CreateVehicleRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (persistence.vehicleCodeExists(code)) throw conflict("VEHICLE_CODE_EXISTS", "El código de vehículo ya está registrado.");
        var item = persistence.createVehicle(new CustomerRoutePort.NewVehicle(code,
                safe(request.licensePlate()).toUpperCase(Locale.ROOT), safe(request.description())));
        return vehicle(item);
    }

    @Transactional(readOnly = true)
    public List<VehicleResponse> findVehicles() { return persistence.findVehicles().stream().map(this::vehicle).toList(); }

    @Transactional(readOnly = true)
    public List<SellerOptionResponse> findSellers() {
        return persistence.findSellers().stream().map(item -> new SellerOptionResponse(item.id(), item.code(),
                item.displayName(), item.status())).toList();
    }

    private UUID resolveSeller(UUID userId) {
        return persistence.findSellerIdByUserId(userId).orElseThrow(() -> new BusinessException(
                "SELLER_PROFILE_NOT_FOUND", "El usuario no tiene un perfil de vendedor activo.", ErrorCategory.FORBIDDEN));
    }

    private CustomerResponse customer(CustomerRoutePort.CustomerView item) {
        return new CustomerResponse(item.id(), item.code(), item.name(), item.contactName(), item.phone(),
                item.whatsapp(), item.addressReference(), item.customerType(), item.status(), item.creditAllowed(),
                item.creditLimit(), item.currentBalance(), item.routeId(), item.routeCode(), item.routeName(),
                item.sellerId(), item.sellerName(), item.registrationState(), item.createdAt());
    }

    private RouteResponse route(CustomerRoutePort.RouteView item) {
        return new RouteResponse(item.id(), item.code(), item.name(), item.description(), item.status(),
                item.sellerId(), item.sellerCode(), item.sellerName(), item.vehicleId(), item.vehicleCode(),
                item.licensePlate(), item.customerCount(), item.assignmentValidFrom(), item.createdAt());
    }

    private VehicleResponse vehicle(CustomerRoutePort.VehicleView item) {
        return new VehicleResponse(item.id(), item.code(), item.licensePlate(), item.description(), item.status(), item.createdAt());
    }

    private String normalizeName(String value) {
        return Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }
    private String normalizePhone(String value) { return safe(value).replaceAll("\\D", ""); }
    private String safe(String value) { return value == null ? "" : value.trim(); }
    private BusinessException validation(String code, String message) { return new BusinessException(code, message, ErrorCategory.VALIDATION); }
    private BusinessException conflict(String code, String message) { return new BusinessException(code, message, ErrorCategory.CONFLICT); }
}
