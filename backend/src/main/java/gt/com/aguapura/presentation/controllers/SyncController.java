package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.sync.SyncBatchRequest;
import gt.com.aguapura.application.dto.sync.SyncOperationResult;
import gt.com.aguapura.application.services.SyncBatchApplicationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sync")
public class SyncController {
    private final SyncBatchApplicationService service;

    public SyncController(SyncBatchApplicationService service) {
        this.service = service;
    }

    @PostMapping("/batch")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public List<SyncOperationResult> batch(@Valid @RequestBody SyncBatchRequest request,
                                           @AuthenticationPrincipal Jwt jwt) {
        return service.process(request, UUID.fromString(jwt.getClaimAsString("userId")),
                UUID.fromString(jwt.getClaimAsString("deviceId")), sellerOnly(jwt));
    }

    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR"));
    }
}
