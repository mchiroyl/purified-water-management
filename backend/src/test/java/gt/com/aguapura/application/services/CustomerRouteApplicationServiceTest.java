package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.route.AssignCustomerRouteRequest;
import gt.com.aguapura.application.dto.route.CreateCustomerRequest;
import gt.com.aguapura.application.ports.CustomerRoutePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CustomerRouteApplicationServiceTest {
    private final FakeCustomerRoutePort persistence = new FakeCustomerRoutePort();
    private final CustomerRouteApplicationService service = new CustomerRouteApplicationService(persistence);

    @Test
    void normalizesCustomerIdentityBeforePersisting() {
        service.createCustomer(new CreateCustomerRequest("C-001", "  Tienda El Éxito  ", "Ana",
                "+502 5555-0101", "5555 0101", "Frente al parque", "PERMANENT",
                false, BigDecimal.ZERO), UUID.randomUUID());

        assertThat(persistence.createdCustomer.normalizedName()).isEqualTo("tienda el exito");
        assertThat(persistence.createdCustomer.normalizedPhone()).isEqualTo("50255550101");
    }

    @Test
    void rejectsPotentialDuplicateWithoutMergingIt() {
        persistence.duplicate = true;
        assertThatThrownBy(() -> service.createCustomer(new CreateCustomerRequest("C-002", "Tienda",
                "", "55550101", "", "Zona 1", "PERMANENT", false, BigDecimal.ZERO), UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Existe un posible cliente duplicado; revise las coincidencias antes de continuar.");
    }

    @Test
    void delegatesHistoricalCustomerRouteAssignment() {
        UUID customer = UUID.randomUUID();
        UUID route = UUID.randomUUID();
        UUID actor = UUID.randomUUID();
        service.assignCustomerRoute(customer, new AssignCustomerRouteRequest(route, LocalDate.of(2026, 8, 11)), actor);
        assertThat(persistence.assignment).isEqualTo(new CustomerRoutePort.NewCustomerRoute(customer, route,
                LocalDate.of(2026, 8, 11), actor));
    }

    private static final class FakeCustomerRoutePort implements CustomerRoutePort {
        private NewCustomer createdCustomer;
        private boolean duplicate;
        private NewCustomerRoute assignment;
        @Override public boolean customerCodeExists(String code) { return false; }
        @Override public boolean hasPotentialDuplicate(String normalizedName, String normalizedPhone, String whatsapp) { return duplicate; }
        @Override public CustomerView createCustomer(NewCustomer customer) { createdCustomer = customer; return customerView(customer); }
        @Override public List<CustomerView> findCustomers(Optional<UUID> sellerId) { return new ArrayList<>(); }
        @Override public RouteView assignCustomerRoute(NewCustomerRoute item) { assignment = item; return routeView(item.routeId()); }
        @Override public boolean routeCodeExists(String code) { return false; }
        @Override public RouteView createRoute(NewRoute route) { return null; }
        @Override public List<RouteView> findRoutes(Optional<UUID> sellerId) { return new ArrayList<>(); }
        @Override public boolean vehicleCodeExists(String code) { return false; }
        @Override public VehicleView createVehicle(NewVehicle vehicle) { return null; }
        @Override public List<VehicleView> findVehicles() { return new ArrayList<>(); }
        @Override public List<SellerOption> findSellers() { return new ArrayList<>(); }
        @Override public RouteView assignRoute(NewRouteAssignment assignment) { return null; }
        @Override public Optional<UUID> findSellerIdByUserId(UUID userId) { return Optional.empty(); }

        private CustomerView customerView(NewCustomer customer) {
            return new CustomerView(UUID.randomUUID(), customer.code(), customer.name(), customer.contactName(),
                    customer.phone(), customer.whatsapp(), customer.addressReference(), customer.customerType(),
                    "ACTIVE", customer.creditAllowed(), customer.creditLimit(), BigDecimal.ZERO, null, null,
                    null, null, null, "ACTIVE", java.time.Instant.now());
        }
        private RouteView routeView(UUID id) {
            return new RouteView(id, "R-1", "Ruta 1", "", "ACTIVE", null, null, null,
                    null, null, null, 0, null, java.time.Instant.now());
        }
    }
}
