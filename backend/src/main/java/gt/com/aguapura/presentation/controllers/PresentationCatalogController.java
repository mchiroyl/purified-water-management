package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.catalog.CreatePresentationTemplateRequest;
import gt.com.aguapura.application.dto.catalog.PresentationTemplateResponse;
import gt.com.aguapura.application.services.AuditApplicationService;
import gt.com.aguapura.application.services.PresentationCatalogApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/presentation-catalog")
public class PresentationCatalogController {
    private final PresentationCatalogApplicationService service;
    private final AuditApplicationService audit;

    public PresentationCatalogController(PresentationCatalogApplicationService service, AuditApplicationService audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping
    public List<PresentationTemplateResponse> findAll(@RequestParam(required = false) String query) {
        return service.findAll(query);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public PresentationTemplateResponse create(@Valid @RequestBody CreatePresentationTemplateRequest request,
                                               @AuthenticationPrincipal Jwt jwt) {
        var result = service.create(request);
        audit.record(UUID.fromString(jwt.getClaimAsString("userId")), UUID.fromString(jwt.getClaimAsString("deviceId")),
                "CREATE_PRESENTATION", "PRESENTATION_CATALOG", result.id(), Map.of(),
                Map.of("code", result.code(), "name", result.name()));
        return result;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public PresentationTemplateResponse update(@PathVariable UUID id, @Valid @RequestBody CreatePresentationTemplateRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public PresentationTemplateResponse setActive(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
        return service.setActive(id, request.active());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public void delete(@PathVariable UUID id) { service.delete(id); }

    public record StatusRequest(@NotNull Boolean active) { }
}
