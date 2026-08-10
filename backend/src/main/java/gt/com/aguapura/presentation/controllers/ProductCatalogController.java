package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.catalog.CreateProductRequest;
import gt.com.aguapura.application.dto.catalog.ProductResponse;
import gt.com.aguapura.application.dto.catalog.UpdatePresentationConversionRequest;
import gt.com.aguapura.application.services.ProductCatalogApplicationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@Validated
public class ProductCatalogController {

    private final ProductCatalogApplicationService service;

    public ProductCatalogController(ProductCatalogApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProductResponse> findAll() {
        return service.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse create(@Valid @RequestBody CreateProductRequest request) {
        return service.create(request);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse setActive(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
        return service.setActive(id, request.active());
    }

    @PutMapping("/{productId}/presentations/{presentationId}/conversion")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse updateConversion(@PathVariable UUID productId, @PathVariable UUID presentationId,
                                            @Valid @RequestBody UpdatePresentationConversionRequest request) {
        return service.updateConversion(productId, presentationId, request);
    }

    @PatchMapping("/{productId}/presentations/{presentationId}/status")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public ProductResponse setPresentationActive(@PathVariable UUID productId, @PathVariable UUID presentationId,
                                                 @Valid @RequestBody StatusRequest request) {
        return service.setPresentationActive(productId, presentationId, request.active());
    }

    public record StatusRequest(@NotNull Boolean active) {
    }
}
