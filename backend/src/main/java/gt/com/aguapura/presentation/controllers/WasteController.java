package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.waste.CreateWasteRequest;
import gt.com.aguapura.application.dto.waste.ReviewWasteRequest;
import gt.com.aguapura.application.dto.waste.WasteIndicatorResponse;
import gt.com.aguapura.application.dto.waste.WasteResponse;
import gt.com.aguapura.application.dto.waste.WasteTypeRequest;
import gt.com.aguapura.application.dto.waste.WasteTypeResponse;
import gt.com.aguapura.application.services.WasteApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/wastes")
public class WasteController {
    private final WasteApplicationService service;

    public WasteController(WasteApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<WasteResponse> findAll(@AuthenticationPrincipal Jwt jwt) {
        return service.findWastes(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public WasteResponse create(@Valid @RequestBody CreateWasteRequest request,
                                @AuthenticationPrincipal Jwt jwt) {
        return service.create(request, actor(jwt), device(jwt), sellerOnly(jwt));
    }

    @PostMapping("/{id}/reviews")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA')")
    public WasteResponse review(@PathVariable UUID id, @Valid @RequestBody ReviewWasteRequest request,
                                @AuthenticationPrincipal Jwt jwt) {
        return service.review(id, request, actor(jwt), device(jwt), reviewerRole(jwt));
    }

    @GetMapping("/types")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<WasteTypeResponse> types(@RequestParam(defaultValue = "false") boolean includeInactive) {
        return service.findWasteTypes(includeInactive);
    }

    @PostMapping("/types")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public WasteTypeResponse createType(@Valid @RequestBody WasteTypeRequest request) {
        return service.saveWasteType(request);
    }

    @PutMapping("/types/{id}")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public WasteTypeResponse updateType(@PathVariable UUID id, @Valid @RequestBody WasteTypeRequest request) {
        return service.saveWasteType(id, request);
    }

    @GetMapping("/indicators")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA')")
    public List<WasteIndicatorResponse> indicators() {
        return service.indicators();
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getClaimAsString("userId"));
    }

    private UUID device(Jwt jwt) {
        return UUID.fromString(jwt.getClaimAsString("deviceId"));
    }

    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
    }

    private String reviewerRole(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        if (roles.contains("ADMINISTRADOR")) return "ADMINISTRADOR";
        if (roles.contains("SUPERVISOR")) return "SUPERVISOR";
        return "BODEGA";
    }
}
