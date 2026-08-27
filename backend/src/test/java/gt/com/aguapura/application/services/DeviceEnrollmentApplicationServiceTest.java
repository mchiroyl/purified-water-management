package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.DeviceEnrollmentRequest;
import gt.com.aguapura.application.dto.identity.CreateDeviceEnrollmentRequest;
import gt.com.aguapura.application.ports.*;
import gt.com.aguapura.domain.enums.DeviceStatus;
import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DeviceEnrollmentApplicationServiceTest {
    private final DeviceEnrollmentPort enrollment = mock(DeviceEnrollmentPort.class);
    private final AuthenticationPersistencePort authentication = mock(AuthenticationPersistencePort.class);
    private final OpaqueTokenPort tokens = mock(OpaqueTokenPort.class);
    private final AccessTokenIssuer accessTokens = mock(AccessTokenIssuer.class);
    private final SessionPolicy sessions = mock(SessionPolicy.class);
    private final AuditApplicationService audit = mock(AuditApplicationService.class);
    private final DeviceEnrollmentApplicationService service = new DeviceEnrollmentApplicationService(
            enrollment, authentication, tokens, accessTokens, sessions, audit);

    @Test
    void createsShortLivedInvitationWithoutReturningHash() {
        UUID userId = UUID.randomUUID(), actorId = UUID.randomUUID(), invitationId = UUID.randomUUID();
        Instant created = Instant.now();
        when(enrollment.findUser(userId)).thenReturn(Optional.of(new DeviceEnrollmentPort.UserView(userId, "seller", "ACTIVE")));
        when(tokens.newOpaqueToken()).thenReturn("raw-secret");
        when(tokens.sha256("raw-secret")).thenReturn("hash");
        when(enrollment.create(eq(userId), eq("hash"), eq(actorId), any(Instant.class)))
                .thenReturn(new DeviceEnrollmentPort.InvitationView(invitationId, userId, "seller", "PENDING",
                        actorId, created, created.plus(Duration.ofMinutes(10)), null, null, "hash"));

        var result = service.create(actorId, new CreateDeviceEnrollmentRequest(userId));

        assertThat(result.token()).isEqualTo("raw-secret");
        assertThat(result.payload()).contains("agua-pura://enroll?token=");
        assertThat(result.payload()).doesNotContain("hash");
        verify(audit).record(eq(actorId), isNull(), eq("DEVICE_ENROLLMENT_REQUEST"), anyString(),
                eq(invitationId), anyMap(), anyMap());
    }

    @Test
    void rejectsInactiveSelectedUser() {
        UUID userId = UUID.randomUUID();
        when(enrollment.findUser(userId)).thenReturn(Optional.of(new DeviceEnrollmentPort.UserView(userId, "seller", "INACTIVE")));

        assertThatThrownBy(() -> service.create(UUID.randomUUID(), new CreateDeviceEnrollmentRequest(userId)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("no está activo");
        verify(tokens, never()).newOpaqueToken();
    }

    @Test
    void expiresInvitationAndRejectsReplay() {
        UUID invitationId = UUID.randomUUID(), userId = UUID.randomUUID();
        var expired = new DeviceEnrollmentPort.InvitationView(invitationId, userId, "seller", "PENDING",
                UUID.randomUUID(), Instant.now().minus(Duration.ofMinutes(20)), Instant.now().minusSeconds(1),
                null, null, "hash");
        when(tokens.sha256("expired")).thenReturn("hash");
        when(enrollment.findByTokenHashForUpdate("hash")).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service.accept(new DeviceEnrollmentRequest("expired", "phone", null)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("expiró");
        verify(enrollment).expire(eq(invitationId), any(Instant.class));
        verify(audit).record(isNull(), isNull(), eq("DEVICE_ENROLLMENT_EXPIRE"), anyString(),
                eq(invitationId), anyMap(), anyMap());

        var replay = new DeviceEnrollmentPort.InvitationView(invitationId, userId, "seller", "COMPLETED",
                UUID.randomUUID(), Instant.now().minusSeconds(20), Instant.now().plusSeconds(20),
                Instant.now(), null, "hash");
        when(enrollment.findByTokenHashForUpdate("replay-hash")).thenReturn(Optional.of(replay));
        when(tokens.sha256("replayed")).thenReturn("replay-hash");
        assertThatThrownBy(() -> service.accept(new DeviceEnrollmentRequest("replayed", "phone", null)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("no es válida");
    }

    @Test
    void completesOnceAndAssociatesDeviceWithInvitationUser() {
        UUID invitationId = UUID.randomUUID(), userId = UUID.randomUUID(), deviceId = UUID.randomUUID();
        var invitation = new DeviceEnrollmentPort.InvitationView(invitationId, userId, "seller", "PENDING",
                UUID.randomUUID(), Instant.now(), Instant.now().plus(Duration.ofMinutes(5)),
                null, null, "hash");
        var user = mock(AuthenticationPersistencePort.AuthUser.class);
        var device = mock(AuthenticationPersistencePort.AuthDevice.class);
        when(tokens.sha256("raw")).thenReturn("hash");
        when(tokens.sha256("refresh")).thenReturn("refresh-hash");
        when(enrollment.findByTokenHashForUpdate("hash")).thenReturn(Optional.of(invitation));
        when(authentication.findUserById(userId)).thenReturn(Optional.of(user));
        when(user.getId()).thenReturn(userId);
        when(user.getUsername()).thenReturn("seller");
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(user.getRoleCodes()).thenReturn(Set.of("VENDEDOR"));
        when(user.isMustChangePassword()).thenReturn(false);
        when(enrollment.createDevice(userId, "phone", "1.0")).thenReturn(device);
        when(device.getId()).thenReturn(deviceId);
        when(tokens.newOpaqueToken()).thenReturn("refresh");
        when(sessions.refreshTokenDuration()).thenReturn(Duration.ofDays(1));
        when(accessTokens.issue(user, deviceId)).thenReturn(new AccessTokenIssuer.IssuedAccessToken(
                "access", Instant.now().plusSeconds(300)));

        var result = service.accept(new DeviceEnrollmentRequest("raw", "phone", "1.0"));

        assertThat(result.response().user().id()).isEqualTo(userId);
        verify(enrollment).complete(eq(invitationId), any(Instant.class));
        verify(authentication).createSession(eq(userId), eq(deviceId), any(UUID.class), eq("refresh-hash"),
                any(Instant.class), any(Instant.class));
        verify(device).seen("1.0");
    }

    @Test
    void rejectsAndInvalidatesInvitationWhenTargetIsNoLongerActive() {
        UUID invitationId = UUID.randomUUID(), userId = UUID.randomUUID();
        var invitation = new DeviceEnrollmentPort.InvitationView(invitationId, userId, "seller", "PENDING",
                UUID.randomUUID(), Instant.now(), Instant.now().plusSeconds(300), null, null, "hash");
        var user = mock(AuthenticationPersistencePort.AuthUser.class);
        when(tokens.sha256("raw")).thenReturn("hash");
        when(enrollment.findByTokenHashForUpdate("hash")).thenReturn(Optional.of(invitation));
        when(authentication.findUserById(userId)).thenReturn(Optional.of(user));
        when(user.getStatus()).thenReturn(UserStatus.INACTIVE);

        assertThatThrownBy(() -> service.accept(new DeviceEnrollmentRequest("raw", "phone", null)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("no está disponible");
        verify(enrollment).revoke(eq(invitationId), any(Instant.class));
        verify(audit).record(isNull(), isNull(), eq("DEVICE_ENROLLMENT_REJECT"), anyString(),
                eq(invitationId), anyMap(), anyMap());
    }
}
