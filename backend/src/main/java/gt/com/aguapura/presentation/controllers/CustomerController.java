package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.route.AssignCustomerRouteRequest;
import gt.com.aguapura.application.dto.route.CreateCustomerRequest;
import gt.com.aguapura.application.dto.route.CustomerResponse;
import gt.com.aguapura.application.dto.route.RouteResponse;
import gt.com.aguapura.application.dto.customer.CreateOccasionalCustomerRequest;
import gt.com.aguapura.application.dto.customer.ProvisionalReviewResponse;
import gt.com.aguapura.application.dto.customer.RegistrationDecisionRequest;
import gt.com.aguapura.application.services.CustomerRouteApplicationService;
import gt.com.aguapura.application.services.ProvisionalCustomerApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    private final CustomerRouteApplicationService service;
    private final ProvisionalCustomerApplicationService provisionalCustomers;

    public CustomerController(CustomerRouteApplicationService service,
                              ProvisionalCustomerApplicationService provisionalCustomers) {
        this.service = service;
        this.provisionalCustomers = provisionalCustomers;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public List<CustomerResponse> findAll(@AuthenticationPrincipal Jwt jwt) {
        return service.findCustomers(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public CustomerResponse create(@Valid @RequestBody CreateCustomerRequest request,
                                   @AuthenticationPrincipal Jwt jwt) {
        return service.createCustomer(request, actor(jwt));
    }

    @PostMapping("/occasional")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','VENDEDOR')")
    public CustomerResponse createOccasional(@Valid @RequestBody CreateOccasionalCustomerRequest request,
                                             @AuthenticationPrincipal Jwt jwt) {
        return provisionalCustomers.createOccasional(request, actor(jwt), device(jwt), sellerOnly(jwt));
    }

    @GetMapping("/provisional-reviews")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public List<ProvisionalReviewResponse> findProvisionalReviews() {
        return provisionalCustomers.findPendingReviews();
    }

    @PostMapping("/{id}/registration-decision")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public CustomerResponse decideRegistration(@PathVariable UUID id,
                                               @Valid @RequestBody RegistrationDecisionRequest request,
                                               @AuthenticationPrincipal Jwt jwt) {
        return provisionalCustomers.decideRegistration(id, request, actor(jwt));
    }

    @PostMapping("/{id}/route-assignment")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RouteResponse assignRoute(@PathVariable UUID id, @Valid @RequestBody AssignCustomerRouteRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        return service.assignCustomerRoute(id, request, actor(jwt));
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private UUID device(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("deviceId")); }
    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR"));
    }
}
