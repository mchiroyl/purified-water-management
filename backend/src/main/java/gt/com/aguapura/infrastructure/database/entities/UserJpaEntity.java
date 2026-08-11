package gt.com.aguapura.infrastructure.database.entities;

import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.application.ports.AuthenticationPersistencePort;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class UserJpaEntity implements AuthenticationPersistencePort.AuthUser {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true, length = 80)
    private String username;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.ACTIVE;

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Version
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_role",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<RoleJpaEntity> roles = new LinkedHashSet<>();

    protected UserJpaEntity() {
    }

    public UserJpaEntity(String username, String email, String passwordHash, boolean mustChangePassword) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.mustChangePassword = mustChangePassword;
    }

    @PrePersist
    void beforeInsert() {
        var now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void beforeUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public UserStatus getStatus() {
        return status;
    }

    public boolean isMustChangePassword() {
        return mustChangePassword;
    }

    public int getFailedAttempts() {
        return failedAttempts;
    }

    public Instant getLockedUntil() {
        return lockedUntil;
    }

    public Set<RoleJpaEntity> getRoles() {
        return roles;
    }

    @Override
    public Set<String> getRoleCodes() {
        return roles.stream().map(RoleJpaEntity::getCode).collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    public void addRole(RoleJpaEntity role) {
        roles.add(role);
    }

    public void registerFailedAttempt(int maximumAttempts, Instant lockUntil) {
        if (status == UserStatus.INACTIVE) {
            failedAttempts = 0;
            lockedUntil = null;
            return;
        }
        failedAttempts++;
        if (failedAttempts >= maximumAttempts) {
            status = UserStatus.LOCKED;
            lockedUntil = lockUntil;
        }
    }

    public void registerSuccessfulLogin() {
        failedAttempts = 0;
        lockedUntil = null;
        if (status == UserStatus.LOCKED) {
            status = UserStatus.ACTIVE;
        }
    }

    public boolean isTemporarilyLocked(Instant now) {
        return status == UserStatus.LOCKED && lockedUntil != null && lockedUntil.isAfter(now);
    }

    public void unlockIfExpired(Instant now) {
        if (status == UserStatus.LOCKED && lockedUntil != null && !lockedUntil.isAfter(now)) {
            registerSuccessfulLogin();
        }
    }

    @Override
    public void changePassword(String newPasswordHash) {
        passwordHash = newPasswordHash;
        mustChangePassword = false;
        failedAttempts = 0;
        lockedUntil = null;
    }
}
