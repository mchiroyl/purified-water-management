package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.ChangePasswordRequest;
import gt.com.aguapura.application.dto.auth.LoginRequest;
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
    void replacesAnObsoleteBrowserDeviceIdWhenTheUserHasNoActiveDevice() {
        var persistence = mock(AuthenticationPersistencePort.class);
        var verifier = mock(PasswordVerificationPort.class);
        var tokens = mock(AccessTokenIssuer.class);
        var opaqueTokens = mock(OpaqueTokenPort.class);
        var policy = mock(SessionPolicy.class);
        var user = mock(AuthenticationPersistencePort.AuthUser.class);
        var device = mock(AuthenticationPersistencePort.AuthDevice.class);
        UUID userId = UUID.randomUUID();
        UUID staleDeviceId = UUID.randomUUID();
        UUID replacementDeviceId = UUID.randomUUID();

        when(persistence.findUserByUsername("admin")).thenReturn(Optional.of(user));
        when(user.getId()).thenReturn(userId);
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(user.getPasswordHash()).thenReturn("hash");
        when(user.getRoleCodes()).thenReturn(java.util.Set.of("ADMINISTRADOR"));
        when(verifier.matches("Correct-password-1", "hash")).thenReturn(true);
        when(persistence.findDeviceById(staleDeviceId)).thenReturn(Optional.empty());
        when(persistence.hasActiveDevice(userId)).thenReturn(false);
        when(persistence.createDevice(userId, "Equipo local", "web")).thenReturn(device);
        when(device.getId()).thenReturn(replacementDeviceId);
        when(opaqueTokens.newOpaqueToken()).thenReturn("refresh-token");
        when(opaqueTokens.sha256("refresh-token")).thenReturn("token-hash");
        when(policy.refreshTokenDuration()).thenReturn(java.time.Duration.ofDays(7));
        when(tokens.issue(user, replacementDeviceId)).thenReturn(
                new AccessTokenIssuer.IssuedAccessToken("access-token", Instant.now().plusSeconds(900)));

        var service = new AuthApplicationService(persistence, verifier, tokens, opaqueTokens, policy,
                mock(AuditApplicationService.class), mock(PasswordHashingPort.class));

        var result = service.login(new LoginRequest("admin", "Correct-password-1", "Equipo local", "web", staleDeviceId.toString()));

        org.junit.jupiter.api.Assertions.assertEquals(replacementDeviceId, result.response().user().deviceId());
        verify(persistence).createDevice(userId, "Equipo local", "web");
    }

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
