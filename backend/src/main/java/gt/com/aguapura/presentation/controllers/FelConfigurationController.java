package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.fel.FelConfigurationRequest;
import gt.com.aguapura.application.dto.fel.FelConfigurationResponse;
import gt.com.aguapura.application.services.FelConfigurationApplicationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/fel-configuration")
@PreAuthorize("hasRole('ADMINISTRADOR')")
public class FelConfigurationController {
    private final FelConfigurationApplicationService service;

    public FelConfigurationController(FelConfigurationApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public FelConfigurationResponse get() { return service.get(); }

    @PutMapping
    public FelConfigurationResponse update(@Valid @RequestBody FelConfigurationRequest request,
                                           @AuthenticationPrincipal Jwt jwt) {
        return service.update(request, actor(jwt), device(jwt));
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }
}
