package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.sales.CreateSaleRequest;
import gt.com.aguapura.application.dto.sales.NoPurchaseVisitRequest;
import gt.com.aguapura.application.dto.sales.NoPurchaseVisitResponse;
import gt.com.aguapura.application.dto.sales.SaleLocationResponse;
import gt.com.aguapura.application.dto.sales.SaleResponse;
import gt.com.aguapura.application.services.SalesApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sales")
public class SalesController {
    private final SalesApplicationService service;

    public SalesController(SalesApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public List<SaleResponse> findAll(@AuthenticationPrincipal Jwt jwt) {
        return service.findSales(actor(jwt), sellerOnly(jwt));
    }

    @GetMapping("/{id}/location")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public SaleLocationResponse findLocation(@PathVariable UUID id) {
        return service.findSaleLocation(id);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public SaleResponse findOne(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.findSale(id, actor(jwt), sellerOnly(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public SaleResponse create(@Valid @RequestBody CreateSaleRequest request,
                               @AuthenticationPrincipal Jwt jwt) {
        return service.create(request, actor(jwt), device(jwt), sellerOnly(jwt));
    }

    /**
     * Registers a GPS-stamped visit to a customer who did not purchase on the day.
     * This creates an immutable audit record in route_tracking_point with type NO_PURCHASE_VISIT.
     */
    @PostMapping("/no-purchase-visit")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public NoPurchaseVisitResponse registerNoPurchaseVisit(
            @Valid @RequestBody NoPurchaseVisitRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return service.registerNoPurchaseVisit(request, actor(jwt), device(jwt), sellerOnly(jwt));
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
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR"));
    }
}
