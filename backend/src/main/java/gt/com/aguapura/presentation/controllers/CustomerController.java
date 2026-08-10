package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.route.AssignCustomerRouteRequest;
import gt.com.aguapura.application.dto.route.CreateCustomerRequest;
import gt.com.aguapura.application.dto.route.CustomerResponse;
import gt.com.aguapura.application.dto.route.RouteResponse;
import gt.com.aguapura.application.services.CustomerRouteApplicationService;
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
    public CustomerController(CustomerRouteApplicationService service) { this.service = service; }

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

    @PostMapping("/{id}/route-assignment")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RouteResponse assignRoute(@PathVariable UUID id, @Valid @RequestBody AssignCustomerRouteRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        return service.assignCustomerRoute(id, request, actor(jwt));
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }
    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR"));
    }
}
