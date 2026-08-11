package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.pricing.*;
import gt.com.aguapura.application.ports.PricingPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.pricing.PricePolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PricingApplicationService {
    private final PricingPort persistence;

    public PricingApplicationService(PricingPort persistence) { this.persistence = persistence; }

    @Transactional
    public PriceListResponse createPriceList(CreatePriceListRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (persistence.priceListCodeExists(code)) throw conflict("PRICE_LIST_CODE_EXISTS", "El código de lista ya existe.");
        return priceList(persistence.createPriceList(new PricingPort.NewPriceList(code, request.name().trim(),
                request.currencyCode().toUpperCase(Locale.ROOT))));
    }

    @Transactional(readOnly = true)
    public List<PriceListResponse> findPriceLists() {
        return persistence.findPriceLists().stream().map(this::priceList).toList();
    }

    @Transactional
    public PriceListResponse createPriceVersion(UUID listId, CreatePriceVersionRequest request, UUID actorId) {
        validateTiers(request.tiers());
        var tiers = request.tiers().stream().map(item -> new PricingPort.NewTier(item.presentationId(),
                item.minimumBaseUnits(), item.maximumBaseUnits(), item.unitPrice())).toList();
        return priceList(persistence.createPriceVersion(new PricingPort.NewPriceVersion(listId,
                persistence.nextVersionNumber(listId), request.validFrom(), actorId, tiers)));
    }

    @Transactional
    public PriceListResponse activateVersion(UUID versionId) {
        return priceList(persistence.activatePriceVersion(versionId, Instant.now()));
    }

    @Transactional
    public SpecialPriceResponse createSpecialPrice(CreateSpecialPriceRequest request, UUID actorId) {
        ensureCustomerEligible(request.customerId());
        ensurePresentation(request.presentationId());
        if (request.validTo() != null && !request.validTo().isAfter(request.validFrom())) {
            throw validation("INVALID_SPECIAL_PRICE_DATES", "La fecha final debe ser posterior a la fecha inicial.");
        }
        return special(persistence.createSpecialPrice(new PricingPort.NewSpecialPrice(request.customerId(),
                request.presentationId(), request.unitPrice(), request.validFrom(), request.validTo(), actorId)));
    }

    @Transactional(readOnly = true)
    public List<SpecialPriceResponse> findSpecialPrices() {
        return persistence.findSpecialPrices().stream().map(this::special).toList();
    }

    @Transactional(readOnly = true)
    public PriceDecisionResponse resolve(ResolvePriceRequest request) {
        Instant at = request.at() == null ? Instant.now() : request.at();
        ensurePresentation(request.presentationId());
        var special = request.customerId() == null ? java.util.Optional.<PricePolicy.SpecialPrice>empty()
                : persistence.findSpecialPrice(request.customerId(), request.presentationId(), at);
        try {
            var decision = PricePolicy.resolve(request.quantityBaseUnits(), special,
                    persistence.findApplicableTiers(request.presentationId(), at));
            return new PriceDecisionResponse(decision.unitPrice(), decision.source(), decision.priceVersionId(),
                    decision.priceTierId(), decision.specialPriceId());
        } catch (IllegalArgumentException exception) {
            throw validation("PRICE_NOT_AVAILABLE", exception.getMessage());
        }
    }

    @Transactional
    public DiscountResponse requestDiscount(CreateDiscountRequest request, UUID actorId) {
        ensureCustomerEligible(request.customerId());
        if (!request.expiresAt().isAfter(Instant.now())) {
            throw validation("INVALID_DISCOUNT_EXPIRY", "La solicitud debe tener una vigencia futura.");
        }
        var normal = resolve(new ResolvePriceRequest(request.customerId(), request.presentationId(),
                request.quantityBaseUnits(), Instant.now()));
        if (request.requestedPrice().compareTo(normal.unitPrice()) >= 0) {
            throw validation("INVALID_DISCOUNT_PRICE", "El precio solicitado debe ser menor que el precio calculado.");
        }
        return discount(persistence.createDiscount(new PricingPort.NewDiscount(actorId, request.customerId(),
                request.presentationId(), normal.unitPrice(), request.requestedPrice(), request.reason().trim(),
                request.expiresAt())));
    }

    @Transactional
    public List<DiscountResponse> findDiscounts(UUID userId, boolean restrictedToRequester) {
        return persistence.findDiscounts().stream()
                .filter(item -> !restrictedToRequester || item.requestedBy().equals(userId))
                .map(this::discount).toList();
    }

    @Transactional
    public DiscountResponse decideDiscount(UUID id, DiscountDecisionRequest request, UUID actorId) {
        String decision = request.decision().toUpperCase(Locale.ROOT);
        if (!java.util.Set.of("APPROVED", "REJECTED").contains(decision)) {
            throw validation("INVALID_DISCOUNT_DECISION", "La decisión debe ser APPROVED o REJECTED.");
        }
        var current = persistence.findDiscount(id).orElseThrow(() -> notFound("DISCOUNT_NOT_FOUND", "No se encontró la solicitud."));
        if (current.requestedBy().equals(actorId)) {
            throw new BusinessException("DISCOUNT_SELF_APPROVAL", "El solicitante no puede decidir su propia solicitud.", ErrorCategory.FORBIDDEN);
        }
        if (!"REQUESTED".equals(current.status())) throw conflict("DISCOUNT_ALREADY_DECIDED", "La solicitud ya no está pendiente.");
        if (!current.expiresAt().isAfter(Instant.now())) {
            return discount(persistence.decideDiscount(id, "EXPIRED", actorId, Instant.now()));
        }
        return discount(persistence.decideDiscount(id, decision, actorId, Instant.now()));
    }

    private void validateTiers(List<CreatePriceVersionRequest.TierRequest> items) {
        var groups = items.stream().collect(Collectors.groupingBy(CreatePriceVersionRequest.TierRequest::presentationId));
        for (var entry : groups.entrySet()) {
            ensurePresentation(entry.getKey());
            var sorted = new ArrayList<>(entry.getValue());
            sorted.sort(Comparator.comparing(CreatePriceVersionRequest.TierRequest::minimumBaseUnits));
            if (sorted.getFirst().minimumBaseUnits().compareTo(BigDecimal.ONE) != 0) {
                throw validation("PRICE_TIER_GAP", "Cada presentación debe comenzar su primer tramo en una unidad base.");
            }
            for (int index = 0; index < sorted.size(); index++) {
                var current = sorted.get(index);
                boolean last = index == sorted.size() - 1;
                if (current.maximumBaseUnits() == null && !last) {
                    throw validation("PRICE_TIER_OVERLAP", "Solo el último tramo puede quedar sin límite máximo.");
                }
                if (!last) {
                    var next = sorted.get(index + 1);
                    if (current.maximumBaseUnits() == null
                            || next.minimumBaseUnits().compareTo(current.maximumBaseUnits().add(BigDecimal.ONE)) != 0) {
                        throw validation("PRICE_TIER_GAP", "Los tramos deben ser consecutivos y no traslaparse.");
                    }
                } else if (current.maximumBaseUnits() != null) {
                    throw validation("PRICE_TIER_OPEN_END_REQUIRED", "El último tramo debe cubrir todas las cantidades superiores.");
                }
            }
        }
    }

    private void ensurePresentation(UUID id) {
        if (!persistence.presentationExists(id)) throw notFound("PRESENTATION_NOT_FOUND", "No se encontró la presentación.");
    }
    private void ensureCustomerEligible(UUID id) {
        if (!persistence.customerEligibleForBenefits(id)) {
            throw validation("CUSTOMER_COMMERCIAL_BENEFIT_FORBIDDEN",
                    "Solo un cliente permanente activo puede recibir precio especial o descuento manual.");
        }
    }

    private PriceListResponse priceList(PricingPort.PriceListView item) {
        return new PriceListResponse(item.id(), item.code(), item.name(), item.status(), item.currencyCode(),
                item.versions().stream().map(version -> new PriceListResponse.VersionResponse(version.id(),
                        version.versionNumber(), version.validFrom(), version.validTo(), version.status(),
                        version.tiers().stream().map(tier -> new PriceListResponse.TierResponse(tier.id(),
                                tier.presentationId(), tier.presentationCode(), tier.presentationName(),
                                tier.minimumBaseUnits(), tier.maximumBaseUnits(), tier.unitPrice())).toList())).toList());
    }
    private SpecialPriceResponse special(PricingPort.SpecialPriceView item) {
        return new SpecialPriceResponse(item.id(), item.customerId(), item.customerCode(), item.customerName(),
                item.presentationId(), item.presentationCode(), item.presentationName(), item.unitPrice(),
                item.validFrom(), item.validTo(), item.status());
    }
    private DiscountResponse discount(PricingPort.DiscountView item) {
        return new DiscountResponse(item.id(), item.requestedBy(), item.requesterUsername(), item.approvedBy(),
                item.customerId(), item.customerName(), item.presentationId(), item.presentationName(),
                item.normalPrice(), item.requestedPrice(), item.reason(), item.status(), item.expiresAt(),
                item.decidedAt(), item.createdAt());
    }

    private BusinessException validation(String code, String message) { return new BusinessException(code, message, ErrorCategory.VALIDATION); }
    private BusinessException conflict(String code, String message) { return new BusinessException(code, message, ErrorCategory.CONFLICT); }
    private BusinessException notFound(String code, String message) { return new BusinessException(code, message, ErrorCategory.NOT_FOUND); }
}
