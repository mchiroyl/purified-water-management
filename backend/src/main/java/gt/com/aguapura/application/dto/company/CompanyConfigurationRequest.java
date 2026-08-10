package gt.com.aguapura.application.dto.company;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CompanyConfigurationRequest(
        @NotBlank @Size(min = 2, max = 150) String commercialName,
        @NotBlank @Size(min = 2, max = 200) String legalName,
        @NotBlank @Size(min = 3, max = 30) @Pattern(regexp = "[0-9A-Za-z-]+") String taxId,
        @NotBlank @Size(min = 5, max = 500) String address,
        @Size(max = 30) String phone,
        @Size(max = 30) String whatsapp,
        @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currencyCode,
        @NotBlank @Size(min = 3, max = 80) String timezone,
        @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9-]+") String receiptPrefix,
        @Size(max = 500) String documentLegend
) {
}
