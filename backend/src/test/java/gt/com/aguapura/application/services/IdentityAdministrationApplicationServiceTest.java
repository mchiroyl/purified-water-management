package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.identity.CreateUserRequest;
import gt.com.aguapura.application.ports.IdentityAdministrationPort;
import gt.com.aguapura.application.ports.PasswordHashingPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IdentityAdministrationApplicationServiceTest {

    private final FakeIdentityPort persistence = new FakeIdentityPort();
    private final PasswordHashingPort hashing = raw -> "hashed:" + raw;
    private final IdentityAdministrationApplicationService service =
            new IdentityAdministrationApplicationService(persistence, hashing);

    @Test
    void createsSellerUserWithNormalizedIdentityAndHashedPassword() {
        var result = service.createUser(new CreateUserRequest(
                "  Vendedor.Uno ", " VENDEDOR@EJEMPLO.COM ", "Clave-segura-2026",
                Set.of("VENDEDOR"), " V-001 ", " Juan Pérez "));

        assertThat(result.username()).isEqualTo("vendedor.uno");
        assertThat(result.email()).isEqualTo("vendedor@ejemplo.com");
        assertThat(result.sellerCode()).isEqualTo("V-001");
        assertThat(persistence.created.passwordHash()).isEqualTo("hashed:Clave-segura-2026");
        assertThat(persistence.created.sellerDisplayName()).isEqualTo("Juan Pérez");
    }

    @Test
    void rejectsSellerRoleWithoutSellerProfile() {
        assertThatThrownBy(() -> service.createUser(new CreateUserRequest(
                "vendedor", "vendedor@ejemplo.com", "Clave-segura-2026",
                Set.of("VENDEDOR"), "", "")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("El código y nombre del vendedor son obligatorios.");
    }

    @Test
    void revokesDeviceAndItsSessions() {
        UUID deviceId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();

        service.revokeDevice(deviceId, actorId);

        assertThat(persistence.revokedDeviceId).isEqualTo(deviceId);
        assertThat(persistence.revokedBy).isEqualTo(actorId);
    }

    private static final class FakeIdentityPort implements IdentityAdministrationPort {
        private NewUser created;
        private UUID revokedDeviceId;
        private UUID revokedBy;

        @Override public boolean usernameExists(String username) { return false; }
        @Override public boolean emailExists(String email) { return false; }
        @Override public boolean sellerCodeExists(String code) { return false; }

        @Override
        public UserView create(NewUser user) {
            created = user;
            return new UserView(UUID.randomUUID(), user.username(), user.email(), "ACTIVE", true,
                    user.roles(), user.roles().contains("VENDEDOR") ? UUID.randomUUID() : null,
                    user.sellerCode(), user.sellerDisplayName(), Instant.now());
        }

        @Override public List<UserView> findUsers() { return new ArrayList<>(); }
        @Override public UserView changeUserStatus(UUID userId, String status) { throw new UnsupportedOperationException(); }
        @Override public List<DeviceView> findDevices() { return new ArrayList<>(); }

        @Override
        public DeviceView revokeDevice(UUID deviceId, UUID actorId) {
            revokedDeviceId = deviceId;
            revokedBy = actorId;
            return new DeviceView(deviceId, UUID.randomUUID(), "usuario", "Teléfono", "REVOKED",
                    "1.0", Instant.now(), Instant.now(), Instant.now());
        }
    }
}
