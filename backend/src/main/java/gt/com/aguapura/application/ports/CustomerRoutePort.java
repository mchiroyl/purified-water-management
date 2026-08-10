package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerRoutePort {
    boolean customerCodeExists(String code);
    boolean hasPotentialDuplicate(String normalizedName, String normalizedPhone, String normalizedWhatsapp);
    CustomerView createCustomer(NewCustomer customer);
    List<CustomerView> findCustomers(Optional<UUID> sellerId);
    RouteView assignCustomerRoute(NewCustomerRoute assignment);
    boolean routeCodeExists(String code);
    RouteView createRoute(NewRoute route);
    List<RouteView> findRoutes(Optional<UUID> sellerId);
    boolean vehicleCodeExists(String code);
    VehicleView createVehicle(NewVehicle vehicle);
    List<VehicleView> findVehicles();
    List<SellerOption> findSellers();
    RouteView assignRoute(NewRouteAssignment assignment);
    Optional<UUID> findSellerIdByUserId(UUID userId);

    record NewCustomer(String code, String name, String normalizedName, String contactName, String phone,
                       String normalizedPhone, String whatsapp, String normalizedWhatsapp,
                       String addressReference, String customerType, boolean creditAllowed,
                       BigDecimal creditLimit, UUID createdBy) {}
    record CustomerView(UUID id, String code, String name, String contactName, String phone, String whatsapp,
                        String addressReference, String customerType, String status, boolean creditAllowed,
                        BigDecimal creditLimit, BigDecimal currentBalance, UUID routeId, String routeCode,
                        String routeName, UUID sellerId, String sellerName, String registrationState,
                        Instant createdAt) {}
    record NewRoute(String code, String name, String description) {}
    record RouteView(UUID id, String code, String name, String description, String status,
                     UUID sellerId, String sellerCode, String sellerName, UUID vehicleId,
                     String vehicleCode, String licensePlate, long customerCount, LocalDate assignmentValidFrom,
                     Instant createdAt) {}
    record NewVehicle(String code, String licensePlate, String description) {}
    record VehicleView(UUID id, String code, String licensePlate, String description, String status, Instant createdAt) {}
    record SellerOption(UUID id, String code, String displayName, String status) {}
    record NewRouteAssignment(UUID routeId, UUID sellerId, UUID vehicleId, LocalDate validFrom, UUID assignedBy) {}
    record NewCustomerRoute(UUID customerId, UUID routeId, LocalDate validFrom, UUID assignedBy) {}
}
