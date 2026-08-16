package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.identity.CreateUserRequest;
import gt.com.aguapura.application.dto.identity.DeviceAdministrationResponse;
import gt.com.aguapura.application.dto.identity.UserAdministrationResponse;
import gt.com.aguapura.application.ports.IdentityAdministrationPort;
import gt.com.aguapura.application.ports.PasswordHashingPort;
import gt.com.aguapura.domain.enums.RoleCode;
import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class IdentityAdministrationApplicationService {

    private final IdentityAdministrationPort persistence;
    private final PasswordHashingPort passwordHashing;

    public IdentityAdministrationApplicationService(IdentityAdministrationPort persistence,
                                                     PasswordHashingPort passwordHashing) {
        this.persistence = persistence;
        this.passwordHashing = passwordHashing;
    }

    @Transactional(readOnly = true)
    public List<UserAdministrationResponse> findUsers() {
        return persistence.findUsers().stream().map(this::toUserResponse).toList();
    }

    @Transactional
    public UserAdministrationResponse createUser(CreateUserRequest request) {
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Set<String> roles = normalizeRoles(request.roles());
        String sellerCode = "";
        String sellerName = safe(request.sellerDisplayName());

        if (persistence.usernameExists(username)) {
            throw conflict("USERNAME_EXISTS", "El nombre de usuario ya está registrado.");
        }
        if (persistence.emailExists(email)) {
            throw conflict("EMAIL_EXISTS", "El correo ya está registrado.");
        }
        if (roles.contains(RoleCode.VENDEDOR.name()) && sellerName.isBlank()) {
            throw validation("SELLER_PROFILE_REQUIRED", "El nombre del vendedor es obligatorio.");
        }

        var user = new IdentityAdministrationPort.NewUser(username, email,
                passwordHashing.encode(request.password()), roles, sellerCode, sellerName);
        return toUserResponse(persistence.create(user));
    }

    @Transactional
    public UserAdministrationResponse changeUserStatus(UUID userId, String requestedStatus, UUID actorId) {
        String status = requestedStatus.toUpperCase(Locale.ROOT);
        if (!Set.of(UserStatus.ACTIVE.name(), UserStatus.INACTIVE.name()).contains(status)) {
            throw validation("INVALID_USER_STATUS", "El estado de usuario no es válido.");
        }
        if (userId.equals(actorId) && UserStatus.INACTIVE.name().equals(status)) {
            throw validation("SELF_DEACTIVATION", "No puede desactivar su propio usuario.");
        }
        return toUserResponse(persistence.changeUserStatus(userId, status));
    }

    @Transactional(readOnly = true)
    public List<DeviceAdministrationResponse> findDevices() {
        return persistence.findDevices().stream().map(this::toDeviceResponse).toList();
    }

    @Transactional
    public DeviceAdministrationResponse revokeDevice(UUID deviceId, UUID actorId) {
        return toDeviceResponse(persistence.revokeDevice(deviceId, actorId));
    }

    private Set<String> normalizeRoles(Set<String> requested) {
        var result = new LinkedHashSet<String>();
        for (String role : requested) {
            try {
                result.add(RoleCode.valueOf(role.trim().toUpperCase(Locale.ROOT)).name());
            } catch (IllegalArgumentException exception) {
                throw validation("INVALID_ROLE", "Uno de los roles no es válido.");
            }
        }
        return Set.copyOf(result);
    }

    private UserAdministrationResponse toUserResponse(IdentityAdministrationPort.UserView user) {
        return new UserAdministrationResponse(user.id(), user.username(), user.email(), user.status(),
                user.mustChangePassword(), user.roles(), user.sellerId(), user.sellerCode(),
                user.sellerDisplayName(), user.createdAt());
    }

    private DeviceAdministrationResponse toDeviceResponse(IdentityAdministrationPort.DeviceView device) {
        return new DeviceAdministrationResponse(device.id(), device.userId(), device.username(),
                device.friendlyName(), device.status(), device.appVersion(), device.firstSeenAt(),
                device.lastSeenAt(), device.revokedAt());
    }

    private String safe(String value) { return value == null ? "" : value.trim(); }
    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }
    private BusinessException conflict(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.CONFLICT);
    }
}
