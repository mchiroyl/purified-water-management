package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.customer.CreateOccasionalCustomerRequest;
import gt.com.aguapura.application.dto.customer.RegistrationDecisionRequest;
import gt.com.aguapura.application.dto.customer.SyncProvisionalCustomerRequest;
import gt.com.aguapura.application.ports.ProvisionalCustomerPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProvisionalCustomerApplicationServiceTest {
    private final FakeProvisionalCustomerPort persistence = new FakeProvisionalCustomerPort();
    private final ProvisionalCustomerApplicationService service = new ProvisionalCustomerApplicationService(persistence);

    @Test
    void synchronizesLocalUuidAsPendingReviewWithoutCommercialBenefits() {
        UUID localId = UUID.randomUUID();
        UUID routeId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        persistence.sellerAssigned = true;

        var result = service.createSyncedProvisional(new SyncProvisionalCustomerRequest(localId, routeId,
                "  Tienda El Éxito  ", "+502 5555-0101", "5555 0101", "Frente al parque"),
                actorId, deviceId, true);

        assertThat(persistence.created.id()).isEqualTo(localId);
        assertThat(persistence.created.normalizedName()).isEqualTo("tienda el exito");
        assertThat(persistence.created.normalizedPhone()).isEqualTo("50255550101");
        assertThat(persistence.created.customerType()).isEqualTo("PROVISIONAL");
        assertThat(persistence.created.registrationState()).isEqualTo("PENDING_REVIEW");
        assertThat(persistence.created.createdBy()).isEqualTo(actorId);
        assertThat(persistence.created.sourceDeviceId()).isEqualTo(deviceId);
        assertThat(result.creditAllowed()).isFalse();
        assertThat(result.creditLimit()).isZero();
    }

    @Test
    void preventsSellerFromCreatingCustomerOnAnotherRoute() {
        persistence.sellerAssigned = false;

        assertThatThrownBy(() -> service.createSyncedProvisional(new SyncProvisionalCustomerRequest(
                UUID.randomUUID(), UUID.randomUUID(), "Cliente", "", "", "Referencia"),
                UUID.randomUUID(), UUID.randomUUID(), true))
                .isInstanceOf(BusinessException.class)
                .hasMessage("El vendedor no está asignado a la ruta seleccionada.");
        assertThat(persistence.created).isNull();
    }

    @Test
    void createsOccasionalCustomerWithMinimumDataAndNoCredit() {
        persistence.sellerAssigned = true;

        var result = service.createOccasional(new CreateOccasionalCustomerRequest(UUID.randomUUID(),
                "Venta ocasional", "5555-0101", "", "Parada del mercado"),
                UUID.randomUUID(), UUID.randomUUID(), true);

        assertThat(persistence.created.customerType()).isEqualTo("OCCASIONAL");
        assertThat(persistence.created.registrationState()).isEqualTo("ACTIVE");
        assertThat(result.creditAllowed()).isFalse();
    }

    @Test
    void mergeKeepsHistoricalSalesOnSourceAndRecordsHumanDecision() {
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        persistence.historicalSales = 2;

        var result = service.decideRegistration(sourceId,
                new RegistrationDecisionRequest("MERGED", targetId, "Mismo teléfono confirmado"), reviewerId);

        assertThat(persistence.decision).isEqualTo(new ProvisionalCustomerPort.RegistrationDecision(
                sourceId, "MERGED", targetId, "Mismo teléfono confirmado", reviewerId));
        assertThat(result.registrationState()).isEqualTo("MERGED");
        assertThat(persistence.historicalSales).isEqualTo(2);
    }

    @Test
    void validatesRegistrationDecisionBeforePersistence() {
        UUID sourceId = UUID.randomUUID();

        assertThatThrownBy(() -> service.decideRegistration(sourceId,
                new RegistrationDecisionRequest("MERGED", sourceId, "Duplicado"), UUID.randomUUID()))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.decideRegistration(sourceId,
                new RegistrationDecisionRequest("REJECTED", null, " "), UUID.randomUUID()))
                .isInstanceOf(BusinessException.class);
        assertThat(persistence.decision).isNull();
    }

    private static final class FakeProvisionalCustomerPort implements ProvisionalCustomerPort {
        private boolean sellerAssigned;
        private NewCustomer created;
        private RegistrationDecision decision;
        private int historicalSales;

        @Override public boolean sellerAssignedToRoute(UUID userId, UUID routeId) { return sellerAssigned; }
        @Override public CustomerView create(NewCustomer customer) { created = customer; return view(customer, customer.registrationState()); }
        @Override public List<ReviewView> findPendingReviews() { return new ArrayList<>(); }
        @Override public CustomerView decide(RegistrationDecision item) {
            decision = item;
            return view(new NewCustomer(item.customerId(), UUID.randomUUID(), "P-1", "Cliente", "cliente", "",
                    "", "", "", "Referencia", "PROVISIONAL", "PENDING_REVIEW", UUID.randomUUID(),
                    UUID.randomUUID()), item.decision());
        }

        private CustomerView view(NewCustomer item, String state) {
            return new CustomerView(item.id(), item.code(), item.name(), "", item.phone(), item.whatsapp(),
                    item.addressReference(), item.customerType(), state.equals("ACTIVE") ? "ACTIVE" : "INACTIVE",
                    false, java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, item.routeId(), "R-1", "Ruta 1",
                    UUID.randomUUID(), "Vendedor", state, Instant.now());
        }
    }
}
