package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.audit.AuditResponse;
import gt.com.aguapura.application.dto.reports.ReportPageResponse;
import gt.com.aguapura.application.services.AuditApplicationService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/audit")
public class AuditController {
    private final AuditApplicationService service;

    public AuditController(AuditApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public ReportPageResponse<AuditResponse> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "") String action,
            @RequestParam(defaultValue = "") String entityType,
            @RequestParam(defaultValue = "") String user,
            @RequestParam(defaultValue = "") String correlationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @AuthenticationPrincipal Jwt jwt) {
        return service.search(from, to, action, entityType, user, correlationId, page, size,
                UUID.fromString(jwt.getClaimAsString("userId")), UUID.fromString(jwt.getClaimAsString("deviceId")));
    }
}
