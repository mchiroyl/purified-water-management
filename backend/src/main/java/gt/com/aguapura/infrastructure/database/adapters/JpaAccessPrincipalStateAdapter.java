package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.AccessPrincipalStatePort;
import gt.com.aguapura.domain.enums.DeviceStatus;
import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.infrastructure.repositories.DeviceJpaRepository;
import gt.com.aguapura.infrastructure.repositories.UserJpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

@Repository
public class JpaAccessPrincipalStateAdapter implements AccessPrincipalStatePort {

    private final UserJpaRepository users;
    private final DeviceJpaRepository devices;

    public JpaAccessPrincipalStateAdapter(UserJpaRepository users, DeviceJpaRepository devices) {
        this.users = users;
        this.devices = devices;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean matchesActivePrincipal(UUID userId, UUID deviceId, Set<String> roles) {
        var user = users.findById(userId).orElse(null);
        if (user == null || user.getStatus() != UserStatus.ACTIVE || !user.getRoleCodes().equals(roles)) {
            return false;
        }
        return devices.findById(deviceId)
                .filter(device -> device.getUserId().equals(userId))
                .filter(device -> device.getStatus() == DeviceStatus.ACTIVE)
                .isPresent();
    }
}
