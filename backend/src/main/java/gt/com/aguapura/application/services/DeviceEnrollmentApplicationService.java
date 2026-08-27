package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.AuthResponse;
import gt.com.aguapura.application.dto.auth.AuthenticationResult;
import gt.com.aguapura.application.dto.auth.DeviceEnrollmentRequest;
import gt.com.aguapura.application.dto.identity.CreateDeviceEnrollmentRequest;
import gt.com.aguapura.application.dto.identity.DeviceEnrollmentInvitationResponse;
import gt.com.aguapura.application.ports.AccessTokenIssuer;
import gt.com.aguapura.application.ports.AuthenticationPersistencePort;
import gt.com.aguapura.application.ports.DeviceEnrollmentPort;
import gt.com.aguapura.application.ports.OpaqueTokenPort;
import gt.com.aguapura.application.ports.SessionPolicy;
import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DeviceEnrollmentApplicationService {
    private static final Duration INVITATION_DURATION = Duration.ofMinutes(10);
    private final DeviceEnrollmentPort enrollment;
    private final AuthenticationPersistencePort authentication;
    private final OpaqueTokenPort tokens;
    private final AccessTokenIssuer accessTokens;
    private final SessionPolicy sessions;
    private final AuditApplicationService audit;

    public DeviceEnrollmentApplicationService(DeviceEnrollmentPort enrollment,
                                              AuthenticationPersistencePort authentication,
                                              OpaqueTokenPort tokens, AccessTokenIssuer accessTokens,
                                              SessionPolicy sessions, AuditApplicationService audit) {
        this.enrollment = enrollment;
        this.authentication = authentication;
        this.tokens = tokens;
        this.accessTokens = accessTokens;
        this.sessions = sessions;
        this.audit = audit;
    }

    @Transactional
    public DeviceEnrollmentInvitationResponse create(UUID actorId, CreateDeviceEnrollmentRequest request) {
        var user = enrollment.findUser(request.userId())
                .orElseThrow(() -> error("ENROLLMENT_USER_NOT_FOUND", "No se encontró el usuario seleccionado.",
                        ErrorCategory.NOT_FOUND));
        if (!UserStatus.ACTIVE.name().equals(user.status())) {
            throw error("ENROLLMENT_USER_UNAVAILABLE", "El usuario seleccionado no está activo.",
                    ErrorCategory.VALIDATION);
        }
        var now = Instant.now();
        enrollment.revokePendingForUser(user.id(), now);
        String rawToken = tokens.newOpaqueToken();
        var invitation = enrollment.create(user.id(), tokens.sha256(rawToken), actorId,
                now.plus(INVITATION_DURATION));
        audit.record(actorId, null, "DEVICE_ENROLLMENT_REQUEST", "DEVICE_ENROLLMENT",
                invitation.id(), Map.of(), Map.of("userId", user.id().toString(), "expiresAt",
                        invitation.expiresAt().toString()));
        return response(invitation, rawToken);
    }

    @Transactional
    public List<DeviceEnrollmentInvitationResponse> findAll() {
        Instant now = Instant.now();
        return enrollment.findAll().stream().map(invitation -> {
            if ("PENDING".equals(invitation.status()) && !invitation.expiresAt().isAfter(now)) {
                enrollment.expire(invitation.id(), now);
                audit.record(null, null, "DEVICE_ENROLLMENT_EXPIRE", "DEVICE_ENROLLMENT",
                        invitation.id(), Map.of(), Map.of("status", "EXPIRED"));
                return new DeviceEnrollmentPort.InvitationView(invitation.id(), invitation.userId(),
                        invitation.username(), "EXPIRED", invitation.createdBy(), invitation.createdAt(),
                        invitation.expiresAt(), invitation.consumedAt(), now, invitation.tokenHash());
            }
            return invitation;
        }).map(invitation -> response(invitation, null)).toList();
    }

    @Transactional
    public void revoke(UUID actorId, UUID invitationId) {
        var invitation = enrollment.findAll().stream()
                .filter(item -> item.id().equals(invitationId)).findFirst()
                .orElseThrow(() -> error("ENROLLMENT_NOT_FOUND", "No se encontró la invitación.",
                        ErrorCategory.NOT_FOUND));
        if ("PENDING".equals(invitation.status())) {
            enrollment.revoke(invitationId, Instant.now());
            audit.record(actorId, null, "DEVICE_ENROLLMENT_REVOKE", "DEVICE_ENROLLMENT",
                    invitationId, Map.of(), Map.of("status", "REVOKED"));
        }
    }

    @Transactional
    public AuthenticationResult accept(DeviceEnrollmentRequest request) {
        String rawToken = extractToken(request.token());
        if (rawToken.isBlank()) return reject(null, "MISSING_TOKEN");
        var invitation = enrollment.findByTokenHashForUpdate(tokens.sha256(rawToken)).orElse(null);
        if (invitation == null) return reject(null, "INVALID_TOKEN");
        var now = Instant.now();
        if (!"PENDING".equals(invitation.status())) return reject(invitation, "TOKEN_REPLAY_OR_REVOKED");
        if (!invitation.expiresAt().isAfter(now)) {
            enrollment.expire(invitation.id(), now);
            audit.record(null, null, "DEVICE_ENROLLMENT_EXPIRE", "DEVICE_ENROLLMENT",
                    invitation.id(), Map.of(), Map.of("status", "EXPIRED"));
            throw error("ENROLLMENT_EXPIRED", "La invitación expiró.", ErrorCategory.UNAUTHORIZED);
        }
        var user = authentication.findUserById(invitation.userId()).orElse(null);
        if (user == null || user.getStatus() != UserStatus.ACTIVE) {
            enrollment.revoke(invitation.id(), now);
            audit.record(null, null, "DEVICE_ENROLLMENT_REJECT", "DEVICE_ENROLLMENT",
                    invitation.id(), Map.of(), Map.of("reason", "USER_UNAVAILABLE"));
            throw error("ENROLLMENT_USER_UNAVAILABLE", "El usuario ya no está disponible.",
                    ErrorCategory.UNAUTHORIZED);
        }
        var device = enrollment.createDevice(user.getId(), request.deviceName().trim(), request.appVersion());
        device.seen(request.appVersion());
        authentication.saveDevice(device);
        enrollment.complete(invitation.id(), now);
        audit.record(user.getId(), device.getId(), "DEVICE_ENROLLMENT_COMPLETE", "DEVICE",
                device.getId(), Map.of(), Map.of("invitationId", invitation.id().toString()));
        return issueSession(user, device.getId());
    }

    private AuthenticationResult issueSession(AuthenticationPersistencePort.AuthUser user, UUID deviceId) {
        String rawRefresh = tokens.newOpaqueToken();
        Instant now = Instant.now();
        authentication.createSession(user.getId(), deviceId, UUID.randomUUID(), tokens.sha256(rawRefresh),
                now, now.plus(sessions.refreshTokenDuration()));
        var access = accessTokens.issue(user, deviceId);
        return new AuthenticationResult(new AuthResponse(access.value(), access.expiresAt(),
                new gt.com.aguapura.application.dto.auth.SessionUserResponse(user.getId(), user.getUsername(),
                        user.getUsername(), deviceId, user.getRoleCodes(), user.isMustChangePassword())), rawRefresh);
    }

    private AuthenticationResult reject(DeviceEnrollmentPort.InvitationView invitation, String reason) {
        UUID id = invitation == null ? null : invitation.id();
        audit.record(null, null, "DEVICE_ENROLLMENT_REJECT", "DEVICE_ENROLLMENT", id,
                Map.of(), Map.of("reason", reason));
        throw error("ENROLLMENT_INVALID", "La invitación no es válida.", ErrorCategory.UNAUTHORIZED);
    }

    private String extractToken(String payload) {
        String value = payload == null ? "" : payload.trim();
        if (value.startsWith("http://") || value.startsWith("https://")) {
            try {
                var uri = java.net.URI.create(value);
                var query = uri.getRawQuery();
                if (query == null) return "";
                for (String parameter : query.split("&")) {
                    var pair = parameter.split("=", 2);
                    if (pair.length == 2 && "token".equals(pair[0])) {
                        value = java.net.URLDecoder.decode(pair[1], java.nio.charset.StandardCharsets.UTF_8);
                        value = value.trim();
                        if (value.length() > 64 && value.length() % 64 == 0
                                && value.matches("[A-Za-z0-9_-]+")) {
                            String first = value.substring(0, 64);
                            boolean repeated = true;
                            for (int start = 64; start < value.length(); start += 64) {
                                if (!first.equals(value.substring(start, start + 64))) {
                                    repeated = false;
                                    break;
                                }
                            }
                            if (repeated) return first;
                        }
                        return value;
                    }
                }
                return "";
            } catch (IllegalArgumentException ignored) {
                return "";
            }
        }
        if (value.startsWith("agua-pura://enroll?token=")) {
            value = value.substring("agua-pura://enroll?token=".length());
            try { value = java.net.URLDecoder.decode(value, java.nio.charset.StandardCharsets.UTF_8); }
            catch (IllegalArgumentException ignored) { return ""; }
        }
        if (value.startsWith("AGUA-PURA-ENROLL:")) value = value.substring("AGUA-PURA-ENROLL:".length());
        return value.trim();
    }

    private DeviceEnrollmentInvitationResponse response(DeviceEnrollmentPort.InvitationView invitation,
                                                        String token) {
        String payload = token == null ? null : "agua-pura://enroll?token="
                + java.net.URLEncoder.encode(token, java.nio.charset.StandardCharsets.UTF_8);
        return new DeviceEnrollmentInvitationResponse(invitation.id(), invitation.userId(),
                invitation.username(), invitation.status(), invitation.createdAt(), invitation.expiresAt(),
                token, payload);
    }

    private BusinessException error(String code, String message, ErrorCategory category) {
        return new BusinessException(code, message, category);
    }
}
