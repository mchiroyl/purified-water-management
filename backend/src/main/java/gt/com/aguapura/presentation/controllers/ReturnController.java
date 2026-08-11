package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.returns.ConfirmReturnReceiptRequest;
import gt.com.aguapura.application.dto.returns.CreateReturnRequest;
import gt.com.aguapura.application.dto.returns.ReturnResponse;
import gt.com.aguapura.application.services.ReturnApplicationService;
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
@RequestMapping("/api/returns")
public class ReturnController {
    private final ReturnApplicationService service;

    public ReturnController(ReturnApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public List<ReturnResponse> findAll(@AuthenticationPrincipal Jwt jwt) {
        return service.findReturns(actor(jwt), sellerOnly(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
    public ReturnResponse create(@Valid @RequestBody CreateReturnRequest request,
                                 @AuthenticationPrincipal Jwt jwt) {
        return service.create(request, actor(jwt), device(jwt), sellerOnly(jwt));
    }

    @PostMapping("/{id}/receipt")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA')")
    public ReturnResponse confirmReceipt(@PathVariable UUID id,
                                         @Valid @RequestBody ConfirmReturnReceiptRequest request,
                                         @AuthenticationPrincipal Jwt jwt) {
        return service.confirmReceipt(id, request, actor(jwt), device(jwt), receiverRole(jwt));
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

    private String receiverRole(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        if (roles.contains("ADMINISTRADOR")) return "ADMINISTRADOR";
        if (roles.contains("SUPERVISOR")) return "SUPERVISOR";
        return "BODEGA";
    }
}
