package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.settlement.CashDeliveryRequest;
import gt.com.aguapura.application.dto.settlement.SettlementResponse;
import gt.com.aguapura.application.ports.SettlementPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.settlement.SettlementCalculator;
import gt.com.aguapura.domain.settlement.SettlementClosePolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class SettlementApplicationService {
    private final SettlementPort persistence;

    public SettlementApplicationService(SettlementPort persistence) {
        this.persistence = persistence;
    }

    @Transactional
    public SettlementResponse calculate(UUID loadId, int pendingLocalOperations, UUID actorId,
                                        boolean restrictedToSeller) {
        authorize(loadId, actorId, restrictedToSeller);
        var source = persistence.loadSource(loadId);
        var blockers = new ArrayList<>(source.blockers());
        if (pendingLocalOperations > 0) blockers.add("LOCAL_OUTBOX:" + pendingLocalOperations);
        var items = source.products().stream().map(row -> {
            var result = SettlementCalculator.calculateProduct(row.loadedUnits(), row.soldUnits(),
                    row.returnedGoodUnits(), row.approvedWasteUnits());
            return new SettlementPort.NewItem(UUID.randomUUID(), row, result.physicalDifference());
        }).toList();
        var physicalDifference = items.stream().map(row -> row.physicalDifference().abs())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        var monetaryDifference = SettlementCalculator.calculateFinancial(source.financial().expectedCash(),
                source.financial().deliveredCash()).monetaryDifference();
        String status = !blockers.isEmpty() ? "PENDING"
                : physicalDifference.signum() == 0 && monetaryDifference.signum() == 0
                ? "BALANCED" : "WITH_DIFFERENCE";
        return response(persistence.saveCalculation(new SettlementPort.NewCalculation(UUID.randomUUID(),
                source, status, monetaryDifference, physicalDifference, List.copyOf(blockers), items)));
    }

    @Transactional
    public SettlementResponse close(UUID loadId, int pendingLocalOperations, String notes,
                                    UUID actorId, UUID deviceId, String role) {
        var source = persistence.loadSource(loadId);
        var calculated = calculate(loadId, pendingLocalOperations, actorId, false);
        SettlementClosePolicy.validate(source.loadStatus(), role, pendingLocalOperations,
                calculated.blockingReasons().stream().filter(reason -> !reason.startsWith("LOCAL_OUTBOX:"))
                        .toList(), notes);
        return response(persistence.close(loadId, actorId, deviceId, notes.trim()));
    }

    @Transactional
    public SettlementResponse addCashDelivery(UUID loadId, CashDeliveryRequest request,
                                              UUID actorId, UUID deviceId) {
        var source = persistence.loadSource(loadId);
        if (!"STARTED".equals(source.loadStatus())) throw new BusinessException("CASH_DELIVERY_LOAD_CLOSED",
                "La carga de ruta no admite entregas de efectivo.", ErrorCategory.CONFLICT);
        persistence.addCashDelivery(loadId, actorId, deviceId, request.amount(), request.notes().trim());
        return calculate(loadId, 0, actorId, false);
    }

    @Transactional(readOnly = true)
    public List<SettlementResponse> findAll(UUID actorId, boolean restrictedToSeller) {
        return persistence.findAll(restrictedToSeller ? Optional.of(actorId) : Optional.empty())
                .stream().map(this::response).toList();
    }

    private void authorize(UUID loadId, UUID actorId, boolean restrictedToSeller) {
        if (restrictedToSeller && !persistence.sellerOwnsLoad(actorId, loadId)) {
            throw new BusinessException("SETTLEMENT_LOAD_FORBIDDEN",
                    "El vendedor solo puede consultar su propia liquidación.", ErrorCategory.FORBIDDEN);
        }
    }

    private SettlementResponse response(SettlementPort.SettlementView item) {
        var details = item.items().stream().map(row -> new SettlementResponse.Item(row.id(), row.productId(),
                row.productCode(), row.productName(), row.loadedUnits(), row.soldUnits(),
                row.returnedGoodUnits(), row.customerReturnUnits(), row.approvedWasteUnits(),
                row.physicalDifference())).toList();
        var deliveries = item.cashDeliveries().stream().map(row -> new SettlementResponse.CashDelivery(
                row.id(), row.amount(), row.deliveredByUsername(), row.receivedByUsername(), row.notes(),
                row.deliveredAt())).toList();
        return new SettlementResponse(item.id(), item.routeLoadId(), item.loadNumber(), item.routeId(),
                item.routeCode(), item.routeName(), item.sellerName(), item.loadStatus(), item.status(),
                item.salesTotal(), item.expectedCash(), item.deliveredCash(), item.verifiedTransfers(),
                item.appliedCredit(), item.monetaryDifference(), item.physicalDifferenceTotal(),
                item.blockingReasons(), item.calculatedAt(), item.closedBy(), item.closedByUsername(),
                item.closedAt(), item.closeNotes(), details, deliveries);
    }
}
