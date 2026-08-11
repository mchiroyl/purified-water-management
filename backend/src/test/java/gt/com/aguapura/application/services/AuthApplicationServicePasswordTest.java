package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.ChangePasswordRequest;
import gt.com.aguapura.application.ports.AccessTokenIssuer;
import gt.com.aguapura.application.ports.AuthenticationPersistencePort;
import gt.com.aguapura.application.ports.OpaqueTokenPort;
import gt.com.aguapura.application.ports.PasswordHashingPort;
import gt.com.aguapura.application.ports.PasswordVerificationPort;
import gt.com.aguapura.application.ports.SessionPolicy;
import gt.com.aguapura.domain.enums.UserStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.*;

class AuthApplicationServicePasswordTest {

    @Test
    void changesThePasswordClearsTheFlagAndRevokesExistingSessions() {
        var persistence = mock(AuthenticationPersistencePort.class);
        var verifier = mock(PasswordVerificationPort.class);
        var hashing = mock(PasswordHashingPort.class);
        var user = mock(AuthenticationPersistencePort.AuthUser.class);
        var audit = mock(AuditApplicationService.class);
        UUID userId = UUID.randomUUID();
        when(persistence.findUserById(userId)).thenReturn(Optional.of(user));
        when(user.getId()).thenReturn(userId);
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(user.getPasswordHash()).thenReturn("old-hash");
        when(verifier.matches("Current-password-1", "old-hash")).thenReturn(true);
        when(hashing.encode("New-password-2")).thenReturn("new-hash");
        var service = new AuthApplicationService(persistence, verifier, mock(AccessTokenIssuer.class),
                mock(OpaqueTokenPort.class), mock(SessionPolicy.class), audit, hashing);

        service.changePassword(userId, new ChangePasswordRequest("Current-password-1", "New-password-2"));

        verify(user).changePassword("new-hash");
        verify(persistence).saveUser(user);
        verify(persistence).revokeUserSessions(eq(userId), any(Instant.class), eq("PASSWORD_CHANGED"));
    }
}
