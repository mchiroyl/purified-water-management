package gt.com.aguapura.application.ports;

import java.util.Set;
import java.util.UUID;

public interface AccessPrincipalStatePort {
    boolean matchesActivePrincipal(UUID userId, UUID deviceId, Set<String> roles);
}
