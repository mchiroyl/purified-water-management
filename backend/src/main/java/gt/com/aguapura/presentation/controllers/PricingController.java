package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.pricing.*;
import gt.com.aguapura.application.services.PricingApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pricing")
public class PricingController {
    private final PricingApplicationService service;
    public PricingController(PricingApplicationService service) { this.service = service; }

    @GetMapping("/lists")
    public List<PriceListResponse> findLists() { return service.findPriceLists(); }

    @PostMapping("/lists")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PriceListResponse createList(@Valid @RequestBody CreatePriceListRequest request) {
        return service.createPriceList(request);
    }

    @PostMapping("/lists/{id}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PriceListResponse createVersion(@PathVariable UUID id, @Valid @RequestBody CreatePriceVersionRequest request,
                                           @AuthenticationPrincipal Jwt jwt) {
        return service.createPriceVersion(id, request, actor(jwt));
    }

    @PostMapping("/versions/{id}/activate")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PriceListResponse activate(@PathVariable UUID id) { return service.activateVersion(id); }

    @GetMapping("/special-prices")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public List<SpecialPriceResponse> findSpecialPrices() { return service.findSpecialPrices(); }

    @PostMapping("/special-prices")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public SpecialPriceResponse createSpecialPrice(@Valid @RequestBody CreateSpecialPriceRequest request,
                                                   @AuthenticationPrincipal Jwt jwt) {
        return service.createSpecialPrice(request, actor(jwt));
    }

    @PostMapping("/resolve")
    public PriceDecisionResponse resolve(@Valid @RequestBody ResolvePriceRequest request) { return service.resolve(request); }

    @GetMapping("/discounts")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public List<DiscountResponse> findDiscounts(@AuthenticationPrincipal Jwt jwt) {
        return service.findDiscounts(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping("/discounts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public DiscountResponse requestDiscount(@Valid @RequestBody CreateDiscountRequest request,
                                            @AuthenticationPrincipal Jwt jwt) {
        return service.requestDiscount(request, actor(jwt));
    }

    @PostMapping("/discounts/{id}/decision")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public DiscountResponse decideDiscount(@PathVariable UUID id, @Valid @RequestBody DiscountDecisionRequest request,
                                           @AuthenticationPrincipal Jwt jwt) {
        return service.decideDiscount(id, request, actor(jwt));
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR"));
    }
}
