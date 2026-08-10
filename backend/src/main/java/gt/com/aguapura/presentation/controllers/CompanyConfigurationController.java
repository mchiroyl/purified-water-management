package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.company.CompanyConfigurationRequest;
import gt.com.aguapura.application.dto.company.CompanyConfigurationResponse;
import gt.com.aguapura.application.services.CompanyConfigurationApplicationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/company-configuration")
@PreAuthorize("hasRole('ADMINISTRADOR')")
public class CompanyConfigurationController {

    private final CompanyConfigurationApplicationService service;

    public CompanyConfigurationController(CompanyConfigurationApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public CompanyConfigurationResponse get() {
        return service.get();
    }

    @PutMapping
    public CompanyConfigurationResponse upsert(@Valid @RequestBody CompanyConfigurationRequest request) {
        return service.upsert(request);
    }
}
