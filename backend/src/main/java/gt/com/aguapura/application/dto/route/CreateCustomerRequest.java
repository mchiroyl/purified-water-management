package gt.com.aguapura.application.dto.route;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateCustomerRequest(
        @NotBlank @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9-]+") String code,
        @NotBlank @Size(min = 2, max = 180) String name,
        @Size(max = 150) String contactName,
        @Size(max = 30) String phone,
        @Size(max = 30) String whatsapp,
        @NotBlank @Size(min = 3, max = 1000) String addressReference,
        @NotBlank String customerType,
        boolean creditAllowed,
        @NotNull @DecimalMin("0.00") BigDecimal creditLimit
) {}
