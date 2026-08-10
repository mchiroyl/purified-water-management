package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.IdentityAdministrationPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public class JdbcIdentityAdministrationAdapter implements IdentityAdministrationPort {

    private final JdbcClient jdbc;

    public JdbcIdentityAdministrationAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean usernameExists(String username) {
        return exists("SELECT EXISTS(SELECT 1 FROM app_user WHERE username = :value)", username);
    }

    @Override
    public boolean emailExists(String email) {
        return exists("SELECT EXISTS(SELECT 1 FROM app_user WHERE email = :value)", email);
    }

    @Override
    public boolean sellerCodeExists(String code) {
        return exists("SELECT EXISTS(SELECT 1 FROM seller WHERE code = :value)", code);
    }

    @Override
    public UserView create(NewUser user) {
        UUID userId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO app_user(id, username, email, password_hash, must_change_password)
                VALUES (:id, :username, :email, :passwordHash, true)
                """).params(Map.of("id", userId, "username", user.username(), "email", user.email(),
                "passwordHash", user.passwordHash())).update();

        for (String role : user.roles()) {
            jdbc.sql("""
                    INSERT INTO user_role(user_id, role_id)
                    SELECT :userId, id FROM role WHERE code = :role
                    """).param("userId", userId).param("role", role).update();
        }
        if (user.roles().contains("VENDEDOR")) {
            jdbc.sql("""
                    INSERT INTO seller(id, user_id, code, display_name)
                    VALUES (:id, :userId, :code, :displayName)
                    """).param("id", UUID.randomUUID()).param("userId", userId)
                    .param("code", user.sellerCode()).param("displayName", user.sellerDisplayName()).update();
        }
        return findUser(userId);
    }

    @Override
    public List<UserView> findUsers() {
        return jdbc.sql("""
                SELECT u.id, u.username, u.email, u.status, u.must_change_password, u.created_at,
                       s.id AS seller_id, s.code AS seller_code, s.display_name AS seller_display_name
                FROM app_user u
                LEFT JOIN seller s ON s.user_id = u.id
                ORDER BY u.username
                """).query((rs, rowNum) -> userRow(rs)).list().stream().map(this::withRoles).toList();
    }

    @Override
    public UserView changeUserStatus(UUID userId, String status) {
        int changed = jdbc.sql("UPDATE app_user SET status = :status, updated_at = now(), version = version + 1 WHERE id = :id")
                .param("status", status).param("id", userId).update();
        if (changed == 0) throw notFound("USER_NOT_FOUND", "No se encontró el usuario.");
        jdbc.sql("UPDATE seller SET status = :status WHERE user_id = :id")
                .param("status", status).param("id", userId).update();
        if ("INACTIVE".equals(status)) {
            jdbc.sql("UPDATE refresh_session SET revoked_at = now(), revoke_reason = 'USER_INACTIVE' WHERE user_id = :id AND revoked_at IS NULL")
                    .param("id", userId).update();
        }
        return findUser(userId);
    }

    @Override
    public List<DeviceView> findDevices() {
        return jdbc.sql("""
                SELECT d.id, d.user_id, u.username, d.friendly_name, d.status, d.app_version,
                       d.first_seen_at, d.last_seen_at, d.revoked_at
                FROM device d
                JOIN app_user u ON u.id = d.user_id
                ORDER BY d.last_seen_at DESC
                """).query((rs, rowNum) -> deviceRow(rs)).list();
    }

    @Override
    public DeviceView revokeDevice(UUID deviceId, UUID actorId) {
        int changed = jdbc.sql("""
                UPDATE device SET status = 'REVOKED', revoked_at = now(), revoked_by = :actorId
                WHERE id = :id AND status <> 'REVOKED'
                """).param("actorId", actorId).param("id", deviceId).update();
        if (changed == 0 && !exists("SELECT EXISTS(SELECT 1 FROM device WHERE id = :value)", deviceId)) {
            throw notFound("DEVICE_NOT_FOUND", "No se encontró el dispositivo.");
        }
        jdbc.sql("""
                UPDATE refresh_session SET revoked_at = COALESCE(revoked_at, now()), revoke_reason = 'DEVICE_REVOKED'
                WHERE device_id = :id AND revoked_at IS NULL
                """).param("id", deviceId).update();
        return jdbc.sql("""
                SELECT d.id, d.user_id, u.username, d.friendly_name, d.status, d.app_version,
                       d.first_seen_at, d.last_seen_at, d.revoked_at
                FROM device d JOIN app_user u ON u.id = d.user_id WHERE d.id = :id
                """).param("id", deviceId).query((rs, rowNum) -> deviceRow(rs)).single();
    }

    private boolean exists(String sql, Object value) {
        return Boolean.TRUE.equals(jdbc.sql(sql).param("value", value).query(Boolean.class).single());
    }

    private UserView findUser(UUID id) {
        return jdbc.sql("""
                SELECT u.id, u.username, u.email, u.status, u.must_change_password, u.created_at,
                       s.id AS seller_id, s.code AS seller_code, s.display_name AS seller_display_name
                FROM app_user u LEFT JOIN seller s ON s.user_id = u.id WHERE u.id = :id
                """).param("id", id).query((rs, rowNum) -> userRow(rs)).optional()
                .map(this::withRoles).orElseThrow(() -> notFound("USER_NOT_FOUND", "No se encontró el usuario."));
    }

    private UserView userRow(ResultSet rs) throws SQLException {
        return new UserView(rs.getObject("id", UUID.class), rs.getString("username"), rs.getString("email"),
                rs.getString("status"), rs.getBoolean("must_change_password"), new LinkedHashSet<>(),
                rs.getObject("seller_id", UUID.class), rs.getString("seller_code"),
                rs.getString("seller_display_name"), instant(rs, "created_at"));
    }

    private UserView withRoles(UserView user) {
        var roles = new LinkedHashSet<>(jdbc.sql("""
                SELECT r.code FROM role r JOIN user_role ur ON ur.role_id = r.id
                WHERE ur.user_id = :id ORDER BY r.code
                """).param("id", user.id()).query(String.class).list());
        return new UserView(user.id(), user.username(), user.email(), user.status(), user.mustChangePassword(),
                roles, user.sellerId(), user.sellerCode(), user.sellerDisplayName(), user.createdAt());
    }

    private DeviceView deviceRow(ResultSet rs) throws SQLException {
        return new DeviceView(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                rs.getString("username"), rs.getString("friendly_name"), rs.getString("status"),
                rs.getString("app_version"), instant(rs, "first_seen_at"),
                instant(rs, "last_seen_at"), instant(rs, "revoked_at"));
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private BusinessException notFound(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.NOT_FOUND);
    }
}
