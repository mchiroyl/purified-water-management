package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.company.CompanyConfigurationRequest;
import gt.com.aguapura.application.dto.company.CompanyConfigurationResponse;
import gt.com.aguapura.application.services.CompanyConfigurationApplicationService;
import gt.com.aguapura.application.services.CompanyLogoApplicationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/company-configuration")
public class CompanyConfigurationController {

    private final CompanyConfigurationApplicationService service;
    private final CompanyLogoApplicationService logoService;

    public CompanyConfigurationController(CompanyConfigurationApplicationService service,
                                          CompanyLogoApplicationService logoService) {
        this.service = service;
        this.logoService = logoService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public CompanyConfigurationResponse get() {
        return service.get();
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public CompanyConfigurationResponse upsert(@Valid @RequestBody CompanyConfigurationRequest request) {
        return service.upsert(request);
    }

    @PostMapping(value = "/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public CompanyConfigurationResponse uploadLogo(@RequestPart("logo") MultipartFile logo,
                                                   @AuthenticationPrincipal Jwt jwt) throws IOException {
        logoService.store(logo.getOriginalFilename(), logo.getContentType(), logo.getBytes(),
                UUID.fromString(jwt.getClaimAsString("userId")));
        return service.get();
    }

    @GetMapping("/logo")
    @PreAuthorize("permitAll()")
    public ResponseEntity<byte[]> getLogo() {
        var logo = logoService.get();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(logo.mediaType()))
                .cacheControl(CacheControl.noCache()).body(logo.content());
    }
}
