package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.annulment.AnnulmentResponse;
import gt.com.aguapura.application.dto.annulment.CreateAnnulmentRequest;
import gt.com.aguapura.application.dto.annulment.DecideAnnulmentRequest;
import gt.com.aguapura.application.ports.AnnulmentPort;
import gt.com.aguapura.domain.annulment.AnnulmentDecisionPolicy;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AnnulmentApplicationService {
    private final AnnulmentPort persistence;
    private final InventoryApplicationService inventory;

    public AnnulmentApplicationService(AnnulmentPort persistence, InventoryApplicationService inventory) {
        this.persistence=persistence; this.inventory=inventory;
    }

    @Transactional
    public AnnulmentResponse request(CreateAnnulmentRequest request, UUID actorId, UUID deviceId,
                                     boolean restrictedToSeller) {
        if (restrictedToSeller && !persistence.sellerOwnsSale(actorId, request.saleId())) throw forbidden(
                "ANNULMENT_SALE_FORBIDDEN", "La venta no pertenece al vendedor.");
        if (persistence.findBySale(request.saleId()).isPresent()) throw conflict("ANNULMENT_DUPLICATE",
                "La venta ya tiene una solicitud de anulación.");
        var sale=persistence.findSale(request.saleId());
        if (!sale.routeOpen()) throw conflict("ANNULMENT_ROUTE_CLOSED",
                "No se puede anular después de cerrar la ruta.");
        return response(persistence.create(new AnnulmentPort.NewAnnulment(UUID.randomUUID(),sale,actorId,deviceId,
                request.reason().trim())));
    }

    @Transactional
    public AnnulmentResponse decide(UUID id, DecideAnnulmentRequest request, UUID actorId, UUID deviceId) {
        var item=persistence.findForDecision(id);
        String status=AnnulmentDecisionPolicy.decide(item.status(),item.requestedBy(),actorId,request.decision());
        var sale=persistence.findSale(item.saleId());
        if ("APPROVED".equals(status) && !sale.routeOpen()) throw conflict("ANNULMENT_ROUTE_CLOSED",
                "No se puede aplicar la anulación después de liquidar la ruta.");
        var decided=persistence.decide(id,status,actorId,deviceId,request.notes().trim());
        if ("APPROVED".equals(status)) {
            var totals=new LinkedHashMap<UUID,AnnulmentPort.SaleItem>();
            for (var row:sale.items()) totals.merge(row.productId(),row,(left,right)->new AnnulmentPort.SaleItem(
                    left.productId(),left.productName(),left.quantityBaseUnits().add(right.quantityBaseUnits())));
            for (var row:totals.values()) inventory.receive(sale.routeLocationId(),row.productId(),
                    row.quantityBaseUnits(),"VOID_IN","Anulación autorizada de venta","SALE_ANNULMENT",id,actorId,deviceId);
        }
        return response("APPROVED".equals(status) ? persistence.findForDecision(id) : decided);
    }

    @Transactional(readOnly=true)
    public List<AnnulmentResponse> findAll(UUID actorId, boolean restrictedToSeller) {
        return persistence.findAll(restrictedToSeller?Optional.of(actorId):Optional.empty()).stream().map(this::response).toList();
    }
    private AnnulmentResponse response(AnnulmentPort.AnnulmentView item) {
        return new AnnulmentResponse(item.id(),item.saleId(),item.documentNumber(),item.routeId(),item.routeCode(),
                item.routeName(),item.customerName(),item.saleTotal(),item.status(),item.reason(),item.requestedBy(),
                item.requestedByUsername(),item.decidedBy(),item.decidedByUsername(),item.decisionNotes(),
                item.requestedAt(),item.decidedAt(),item.effects().stream().map(row->new AnnulmentResponse.Effect(
                row.effectType(),row.paymentMethod(),row.amount(),row.productId(),row.productName(),row.quantityBaseUnits())).toList());
    }
    private BusinessException forbidden(String code,String message){return new BusinessException(code,message,ErrorCategory.FORBIDDEN);}
    private BusinessException conflict(String code,String message){return new BusinessException(code,message,ErrorCategory.CONFLICT);}
}
