package gt.com.aguapura.application.ports;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface IdentityAdministrationPort {
    boolean usernameExists(String username);
    boolean emailExists(String email);
    boolean sellerCodeExists(String code);
    UserView create(NewUser user);
    List<UserView> findUsers();
    UserView changeUserStatus(UUID userId, String status);
    List<DeviceView> findDevices();
    DeviceView revokeDevice(UUID deviceId, UUID actorId);

    record NewUser(String username, String email, String passwordHash, Set<String> roles,
                   String sellerCode, String sellerDisplayName) {}

    record UserView(UUID id, String username, String email, String status, boolean mustChangePassword,
                    Set<String> roles, UUID sellerId, String sellerCode, String sellerDisplayName,
                    Instant createdAt) {}

    record DeviceView(UUID id, UUID userId, String username, String friendlyName, String status,
                      String appVersion, Instant firstSeenAt, Instant lastSeenAt, Instant revokedAt) {}
}
