package gt.com.aguapura.application.dto.pricing;

import jakarta.validation.constraints.NotBlank;

public record DiscountDecisionRequest(@NotBlank String decision) {}
