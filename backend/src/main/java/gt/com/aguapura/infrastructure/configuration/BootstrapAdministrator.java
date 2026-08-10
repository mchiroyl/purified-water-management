package gt.com.aguapura.infrastructure.configuration;

import gt.com.aguapura.domain.enums.RoleCode;
import gt.com.aguapura.infrastructure.database.entities.UserJpaEntity;
import gt.com.aguapura.infrastructure.repositories.RoleJpaRepository;
import gt.com.aguapura.infrastructure.repositories.UserJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Component
public class BootstrapAdministrator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdministrator.class);

    private final BootstrapProperties properties;
    private final UserJpaRepository users;
    private final RoleJpaRepository roles;
    private final PasswordEncoder passwordEncoder;

    public BootstrapAdministrator(BootstrapProperties properties, UserJpaRepository users,
                                  RoleJpaRepository roles, PasswordEncoder passwordEncoder) {
        this.properties = properties;
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) return;
        if (!isSecureBootstrapPassword(properties.password())) {
            log.warn("No se creó administrador inicial: configure BOOTSTRAP_ADMIN_PASSWORD con al menos 16 caracteres no predeterminados");
            return;
        }
        String username = properties.username().trim().toLowerCase(Locale.ROOT);
        var adminRole = roles.findByCode(RoleCode.ADMINISTRADOR.name())
                .orElseThrow(() -> new IllegalStateException("El rol ADMINISTRADOR no existe"));
        var user = new UserJpaEntity(username, properties.email().trim().toLowerCase(Locale.ROOT),
                passwordEncoder.encode(properties.password()), properties.forcePasswordChange());
        user.addRole(adminRole);
        users.save(user);
        log.info("Administrador inicial creado para el usuario {}. Debe cambiar su contraseña según la política configurada", username);
    }

    private boolean isSecureBootstrapPassword(String password) {
        return password != null && password.length() >= 16 && !password.toLowerCase(Locale.ROOT).startsWith("replace-with");
    }
}
