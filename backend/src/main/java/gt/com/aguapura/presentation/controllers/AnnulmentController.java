package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.annulment.AnnulmentResponse;
import gt.com.aguapura.application.dto.annulment.CreateAnnulmentRequest;
import gt.com.aguapura.application.dto.annulment.DecideAnnulmentRequest;
import gt.com.aguapura.application.services.AnnulmentApplicationService;
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

@RestController @RequestMapping("/api/annulments")
public class AnnulmentController{
    private final AnnulmentApplicationService service;
    public AnnulmentController(AnnulmentApplicationService service){this.service=service;}
    @GetMapping @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public List<AnnulmentResponse> findAll(@AuthenticationPrincipal Jwt jwt){return service.findAll(actor(jwt),sellerOnly(jwt));}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','VENDEDOR')")
    public AnnulmentResponse request(@Valid @RequestBody CreateAnnulmentRequest request,@AuthenticationPrincipal Jwt jwt){return service.request(request,actor(jwt),device(jwt),sellerOnly(jwt));}
    @PostMapping("/{id}/decision") @PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR')")
    public AnnulmentResponse decide(@PathVariable UUID id,@Valid @RequestBody DecideAnnulmentRequest request,@AuthenticationPrincipal Jwt jwt){return service.decide(id,request,actor(jwt),device(jwt));}
    private UUID actor(Jwt jwt){return UUID.fromString(jwt.getClaimAsString("userId"));}
    private UUID device(Jwt jwt){return UUID.fromString(jwt.getClaimAsString("deviceId"));}
    private boolean sellerOnly(Jwt jwt){var roles=jwt.getClaimAsStringList("roles");return roles.contains("VENDEDOR")&&roles.stream().noneMatch(role->role.equals("ADMINISTRADOR")||role.equals("SUPERVISOR"));}
}
