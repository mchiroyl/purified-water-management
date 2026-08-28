package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.DeviceReenrollmentRequest;
import gt.com.aguapura.application.ports.PasswordVerificationPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.infrastructure.database.entities.DeviceReenrollmentRequestJpaEntity;
import gt.com.aguapura.infrastructure.database.entities.UserJpaEntity;
import gt.com.aguapura.infrastructure.repositories.DeviceJpaRepository;
import gt.com.aguapura.infrastructure.repositories.DeviceReenrollmentRequestJpaRepository;
import gt.com.aguapura.infrastructure.repositories.RefreshSessionJpaRepository;
import gt.com.aguapura.infrastructure.repositories.UserJpaRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DeviceReenrollmentApplicationServiceTest {
    @Test
    void createsOnlyHashedTokenAndPreventsAnotherPendingRequest() throws Exception {
        var users = mock(UserJpaRepository.class);
        var devices = mock(DeviceJpaRepository.class);
        var requests = mock(DeviceReenrollmentRequestJpaRepository.class);
        var sessions = mock(RefreshSessionJpaRepository.class);
        var verifier = mock(PasswordVerificationPort.class);
        var audit = mock(AuditApplicationService.class);
        var user = new UserJpaEntity("vendedor", "vendedor@example.com", "hash", false);
        UUID userId = UUID.randomUUID();
        set(user, "id", userId);
        when(users.findByUsername("vendedor")).thenReturn(Optional.of(user));
        when(verifier.matches("Password-segura-1", "hash")).thenReturn(true);
        when(requests.findFirstByUserIdAndStatusOrderByCreatedAtDesc(userId, "PENDING")).thenReturn(Optional.empty());
        when(requests.save(any(DeviceReenrollmentRequestJpaEntity.class))).thenAnswer(invocation -> {
            var request = invocation.getArgument(0, DeviceReenrollmentRequestJpaEntity.class);
            set(request, "id", UUID.randomUUID());
            return request;
        });
        var service = new DeviceReenrollmentApplicationService(users, devices, requests, sessions, verifier, audit);

        var response = service.request(new DeviceReenrollmentRequest("vendedor", "Password-segura-1", "Teléfono de ventas"));

        assertNotNull(response.token());
        verify(requests).save(argThat(row -> !row.getTokenHash().equals(response.token()) && row.getTokenHash().matches("[0-9a-f]{64}")));
        var pending = new DeviceReenrollmentRequestJpaEntity(userId, "Teléfono de ventas", "a".repeat(64), Instant.now().plusSeconds(600));
        when(requests.findFirstByUserIdAndStatusOrderByCreatedAtDesc(userId, "PENDING")).thenReturn(Optional.of(pending));
        var error = assertThrows(BusinessException.class, () -> service.request(new DeviceReenrollmentRequest("vendedor", "Password-segura-1", "Teléfono de ventas")));
        assertEquals("DEVICE_REENROLLMENT_PENDING", error.code());
    }

    @Test
    void expiresPendingRequestBeforeItCanBeApproved() throws Exception {
        var requests = mock(DeviceReenrollmentRequestJpaRepository.class);
        UUID id = UUID.randomUUID();
        var expired = new DeviceReenrollmentRequestJpaEntity(UUID.randomUUID(), "Equipo", "b".repeat(64), Instant.now().minusSeconds(1));
        set(expired, "id", id);
        when(requests.findById(id)).thenReturn(Optional.of(expired));
        var service = new DeviceReenrollmentApplicationService(mock(UserJpaRepository.class), mock(DeviceJpaRepository.class), requests, mock(RefreshSessionJpaRepository.class), mock(PasswordVerificationPort.class), mock(AuditApplicationService.class));

        assertThrows(BusinessException.class, () -> service.approve(id, "Equipo autorizado", UUID.randomUUID()));
        assertEquals("EXPIRED", expired.getStatus());
        verify(requests).save(expired);
    }

    private static void set(Object target, String field, Object value) throws Exception {
        Field declared = target.getClass().getDeclaredField(field);
        declared.setAccessible(true);
        declared.set(target, value);
    }
}
