package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.catalog.CreateProductRequest;
import gt.com.aguapura.application.dto.catalog.ProductResponse;
import gt.com.aguapura.application.dto.catalog.UpdatePresentationConversionRequest;
import gt.com.aguapura.application.dto.catalog.UpdateProductRequest;
import gt.com.aguapura.application.services.ProductCatalogApplicationService;
import gt.com.aguapura.application.services.AuditApplicationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@Validated
public class ProductCatalogController {

    private final ProductCatalogApplicationService service;
    private final AuditApplicationService audit;

    public ProductCatalogController(ProductCatalogApplicationService service, AuditApplicationService audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping
    public List<ProductResponse> findAll() {
        return service.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse create(@Valid @RequestBody CreateProductRequest request, @AuthenticationPrincipal Jwt jwt) {
        var result = service.create(request);
        audit.record(actor(jwt), device(jwt), "CREATE_PRODUCT", "PRODUCT", result.id(), Map.of(),
                Map.of("code", result.code(), "name", result.name(), "active", result.active()));
        return result;
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse setActive(@PathVariable UUID id, @Valid @RequestBody StatusRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        var result = service.setActive(id, request.active());
        audit.record(actor(jwt), device(jwt), "PRODUCT_STATUS_CHANGE", "PRODUCT", id, Map.of(),
                Map.of("active", result.active()));
        return result;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateProductRequest request,
                                  @AuthenticationPrincipal Jwt jwt) {
        var result = service.update(id, request);
        audit.record(actor(jwt), device(jwt), "UPDATE_PRODUCT", "PRODUCT", id, Map.of(), Map.of("name", result.name()));
        return result;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id);
        audit.record(actor(jwt), device(jwt), "DELETE_PRODUCT", "PRODUCT", id, Map.of(), Map.of());
    }

    @PutMapping("/{productId}/presentations/{presentationId}/conversion")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse updateConversion(@PathVariable UUID productId, @PathVariable UUID presentationId,
                                            @Valid @RequestBody UpdatePresentationConversionRequest request,
                                            @AuthenticationPrincipal Jwt jwt) {
        var result = service.updateConversion(productId, presentationId, request);
        audit.record(actor(jwt), device(jwt), "PRESENTATION_CONVERSION_CHANGE", "PRESENTATION", presentationId,
                Map.of(), Map.of("productId", productId, "conversionFactor", request.conversionFactor()));
        return result;
    }

    @PatchMapping("/{productId}/presentations/{presentationId}/status")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse setPresentationActive(@PathVariable UUID productId, @PathVariable UUID presentationId,
                                                 @Valid @RequestBody StatusRequest request,
                                                 @AuthenticationPrincipal Jwt jwt) {
        var result = service.setPresentationActive(productId, presentationId, request.active());
        audit.record(actor(jwt), device(jwt), "PRESENTATION_STATUS_CHANGE", "PRESENTATION", presentationId,
                Map.of(), Map.of("productId", productId, "active", request.active()));
        return result;
    }

    public record StatusRequest(@NotNull Boolean active) {
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }
}
