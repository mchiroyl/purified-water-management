package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.waste.CreateWasteRequest;
import gt.com.aguapura.application.dto.waste.ReviewWasteRequest;
import gt.com.aguapura.application.dto.waste.WasteIndicatorResponse;
import gt.com.aguapura.application.dto.waste.WasteResponse;
import gt.com.aguapura.application.dto.waste.WasteTypeRequest;
import gt.com.aguapura.application.dto.waste.WasteTypeResponse;
import gt.com.aguapura.application.ports.WastePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.waste.WasteReviewPolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class WasteApplicationService {
    private final WastePort persistence;
    private final InventoryApplicationService inventory;
    private final AuditApplicationService audit;

    public WasteApplicationService(WastePort persistence, InventoryApplicationService inventory) {
        this(persistence, inventory, null);
    }

    @Autowired
    public WasteApplicationService(WastePort persistence, InventoryApplicationService inventory,
                                   AuditApplicationService audit) {
        this.persistence = persistence;
        this.inventory = inventory;
        this.audit = audit;
    }

    @Transactional
    public WasteResponse create(CreateWasteRequest request, UUID actorId, UUID deviceId,
                                boolean restrictedToSeller) {
        if (restrictedToSeller && !persistence.sellerAssignedToRoute(actorId, request.routeId())) {
            throw forbidden("WASTE_ROUTE_FORBIDDEN", "El vendedor no está asignado a la ruta seleccionada.");
        }
        var route = persistence.findRouteContext(request.routeId()).orElseThrow(() ->
                validation("WASTE_ROUTE_INVALID", "La ruta activa requiere vendedor e inventario asignados."));
        var seen = new HashSet<String>();
        var items = request.items().stream().map(item -> {
            String key = item.wasteTypeId() + ":" + item.presentationId();
            if (!seen.add(key)) throw validation("WASTE_DUPLICATE_ITEM", "La merma contiene un detalle repetido.");
            var type = persistence.findWasteType(item.wasteTypeId()).filter(WastePort.WasteTypeView::active)
                    .orElseThrow(() -> validation("WASTE_TYPE_NOT_FOUND", "El tipo de merma no está activo."));
            var presentation = persistence.findPresentation(item.presentationId()).orElseThrow(() ->
                    validation("WASTE_PRESENTATION_NOT_FOUND", "La presentación no está activa."));
            BigDecimal capacity = item.presentationQuantity().multiply(presentation.conversionFactor());
            if (item.reportedDamagedUnits().add(item.recoverableUnits()).compareTo(capacity) > 0) {
                throw validation("WASTE_PRESENTATION_CAPACITY",
                        "Las unidades dañadas y recuperables exceden la capacidad de la presentación.");
            }
            return new WastePort.NewWasteItem(UUID.randomUUID(), type, presentation,
                    item.presentationQuantity(), item.reportedDamagedUnits(), item.recoverableUnits());
        }).toList();
        boolean evidenceRequired = items.stream().anyMatch(item ->
                "REQUIRED".equals(item.wasteType().evidencePolicy()));
        if (evidenceRequired && request.evidence().isEmpty()) {
            throw validation("WASTE_EVIDENCE_REQUIRED", "El tipo de merma requiere evidencia fotográfica.");
        }
        var evidence = request.evidence().stream().map(item -> new WastePort.NewEvidence(UUID.randomUUID(),
                item.storageReference().trim(), item.mediaType(), item.sha256().toLowerCase(Locale.ROOT),
                item.capturedAtLocal())).toList();
        var created = persistence.create(new WastePort.NewWaste(request.clientReference(), request.clientReference(),
                route, actorId, deviceId, request.reason().trim(), request.occurredAtLocal(), items, evidence));
        var result = response(created);
        if (audit != null) audit.record(actorId, deviceId, "CREATE_WASTE", "WASTE", result.id(), Map.of(),
                Map.of("routeId", result.routeId(), "reportedBaseUnits", result.reportedBaseUnits(),
                        "status", result.status(), "evidenceCount", result.evidence().size()));
        return result;
    }

    @Transactional(readOnly = true)
    public List<WasteResponse> findWastes(UUID actorId, boolean restrictedToSeller) {
        return persistence.findWastes(restrictedToSeller ? Optional.of(actorId) : Optional.empty())
                .stream().map(this::response).toList();
    }

    @Transactional
    public WasteResponse review(UUID id, ReviewWasteRequest request, UUID actorId, UUID deviceId, String role) {
        var waste = persistence.findForReview(id);
        boolean alreadyParticipated = waste.reviews().stream().anyMatch(review -> review.reviewerId().equals(actorId));
        if (alreadyParticipated) throw forbidden("WASTE_REVIEWER_REUSE",
                "La segunda revisión requiere una persona distinta.");
        var requested = new HashMap<UUID, BigDecimal>();
        for (var item : request.items()) {
            if (requested.put(item.itemId(), item.approvedBaseUnits()) != null) {
                throw validation("WASTE_REVIEW_DUPLICATE_ITEM", "La revisión contiene un detalle repetido.");
            }
        }
        if (!requested.keySet().equals(waste.items().stream().map(WastePort.WasteItemView::id)
                .collect(java.util.stream.Collectors.toSet()))) {
            throw validation("WASTE_REVIEW_ITEMS", "La revisión debe resolver todos los detalles de la merma.");
        }
        boolean reject = "REJECT".equals(request.decision());
        BigDecimal reported = waste.items().stream().map(WastePort.WasteItemView::reportedBaseUnits)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal approved = waste.items().stream().map(item -> reject ? BigDecimal.ZERO : requested.get(item.id()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal warehouseLimit = waste.items().stream()
                .map(WastePort.WasteItemView::warehouseApprovalLimitBaseUnits).min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
        BigDecimal supervisorLimit = waste.items().stream()
                .map(WastePort.WasteItemView::supervisorApprovalLimitBaseUnits).min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
        var decision = WasteReviewPolicy.review(waste.status(), role, waste.reportedBy().equals(actorId),
                reported, approved, warehouseLimit, supervisorLimit,
                "ADMINISTRADOR".equals(waste.requiredRole()));
        var approvals = waste.items().stream().map(item -> new WastePort.ItemApproval(item.id(),
                reject ? BigDecimal.ZERO : requested.get(item.id()))).toList();
        var reviewed = persistence.review(new WastePort.NewReview(id, actorId, role, request.decision(),
                decision.status(), decision.requiredRole(), request.notes().trim(), approved,
                decision.finalDecision(), approvals));
        if (decision.finalDecision() && approved.signum() > 0) {
            waste.items().stream().sorted((left, right) -> left.productId().compareTo(right.productId()))
                    .filter(item -> requested.get(item.id()).signum() > 0).forEach(item ->
                            inventory.consume(waste.inventoryLocationId(), item.productId(), requested.get(item.id()),
                                    "WASTE_OUT", "Merma aprobada", "WASTE", id, actorId, deviceId));
        }
        var result = response(reviewed);
        String action = "REJECTED".equals(result.status()) ? "REJECT_WASTE"
                : "PARTIALLY_APPROVED".equals(result.status()) ? "PARTIAL_WASTE_APPROVAL"
                : "APPROVED".equals(result.status()) ? "APPROVE_WASTE" : "WASTE_REVIEW";
        if (audit != null) audit.record(actorId, deviceId, action, "WASTE", id, Map.of(),
                Map.of("status", result.status(), "approvedBaseUnits", result.approvedBaseUnits(),
                        "pendingBaseUnits", result.pendingDifferenceBaseUnits()));
        return result;
    }

    @Transactional(readOnly = true)
    public List<WasteTypeResponse> findWasteTypes(boolean includeInactive) {
        return persistence.findWasteTypes(includeInactive).stream().map(this::type).toList();
    }

    @Transactional
    public WasteTypeResponse saveWasteType(WasteTypeRequest request) {
        return saveWasteType(UUID.randomUUID(), request);
    }

    @Transactional
    public WasteTypeResponse saveWasteType(UUID id, WasteTypeRequest request) {
        if (request.supervisorApprovalLimitBaseUnits().compareTo(request.warehouseApprovalLimitBaseUnits()) < 0) {
            throw validation("WASTE_APPROVAL_LIMITS", "El límite de supervisor no puede ser menor al de bodega.");
        }
        return type(persistence.saveWasteType(new WastePort.WasteTypeDefinition(id,
                request.code().trim().toUpperCase(Locale.ROOT), request.name().trim(), request.evidencePolicy(),
                request.warehouseApprovalLimitBaseUnits(), request.supervisorApprovalLimitBaseUnits(),
                request.dailyAlertThreshold(), request.active())));
    }

    @Transactional(readOnly = true)
    public List<WasteIndicatorResponse> indicators() {
        return persistence.indicators().stream().map(row -> new WasteIndicatorResponse(row.sellerId(),
                row.sellerName(), row.routeId(), row.routeName(), row.productId(), row.productName(),
                row.reportCount(), row.reportedBaseUnits(), row.approvedBaseUnits(), row.openAlerts())).toList();
    }

    private WasteResponse response(WastePort.WasteView waste) {
        var items = waste.items().stream().map(row -> new WasteResponse.Item(row.id(), row.wasteTypeId(),
                row.wasteTypeCode(), row.wasteTypeName(), row.evidencePolicy(), row.presentationId(),
                row.presentationCode(), row.presentationName(), row.productId(), row.productCode(),
                row.productName(), row.presentationQuantity(), row.reportedBaseUnits(),
                row.recoverableBaseUnits(), row.approvedBaseUnits())).toList();
        var evidence = waste.evidence().stream().map(row -> new WasteResponse.Evidence(row.id(),
                row.storageReference(), row.mediaType(), row.sha256(), row.capturedDeviceId(),
                row.capturedAtLocal())).toList();
        var reviews = waste.reviews().stream().map(row -> new WasteResponse.Review(row.id(), row.reviewerId(),
                row.reviewerUsername(), row.reviewerRole(), row.decision(), row.approvedBaseUnits(),
                row.notes(), row.reviewedAt())).toList();
        BigDecimal reported = items.stream().map(WasteResponse.Item::reportedBaseUnits)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal approved = items.stream().map(WasteResponse.Item::approvedBaseUnits)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new WasteResponse(waste.id(), waste.clientReference(), waste.routeId(), waste.routeCode(),
                waste.routeName(), waste.inventoryLocationId(), waste.sellerId(), waste.sellerName(),
                waste.reportedBy(), waste.reportedByUsername(), waste.deviceId(), waste.status(),
                waste.requiredRole(), waste.reason(), waste.occurredAtLocal(), waste.receivedAtServer(),
                reported, approved, reported.subtract(approved), items, evidence, reviews);
    }

    private WasteTypeResponse type(WastePort.WasteTypeView item) {
        return new WasteTypeResponse(item.id(), item.code(), item.name(), item.evidencePolicy(),
                item.warehouseApprovalLimitBaseUnits(), item.supervisorApprovalLimitBaseUnits(),
                item.dailyAlertThreshold(), item.active());
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    private BusinessException forbidden(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.FORBIDDEN);
    }
}
