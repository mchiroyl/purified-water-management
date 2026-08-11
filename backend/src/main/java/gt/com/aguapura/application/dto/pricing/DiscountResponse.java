package gt.com.aguapura.application.dto.pricing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record DiscountResponse(UUID id, UUID requestedBy, String requesterUsername, UUID approvedBy,
                               UUID customerId, String customerName, UUID presentationId, String presentationName,
                               BigDecimal normalPrice, BigDecimal requestedPrice, String reason, String status,
                               Instant expiresAt, Instant decidedAt, Instant createdAt) {}
