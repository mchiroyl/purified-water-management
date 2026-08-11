package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.AnnulmentPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcAnnulmentAdapter implements AnnulmentPort {
    private final JdbcClient jdbc;
    public JdbcAnnulmentAdapter(JdbcClient jdbc){this.jdbc=jdbc;}

    @Override public boolean sellerOwnsSale(UUID userId,UUID saleId){
        return Boolean.TRUE.equals(jdbc.sql("SELECT EXISTS(SELECT 1 FROM sale sale JOIN seller s ON s.id=sale.seller_id WHERE sale.id=:id AND s.user_id=:user)")
                .param("id",saleId).param("user",userId).query(Boolean.class).single());
    }
    @Override public Optional<AnnulmentView> findBySale(UUID saleId){
        return jdbc.sql(annulmentSelect()+" WHERE ar.sale_id=:id").param("id",saleId)
                .query((rs,row)->annulmentRow(rs)).optional().map(this::withEffects);
    }
    @Override public SaleSnapshot findSale(UUID saleId){
        var sale=jdbc.sql("""
                SELECT sale.id,sale.document_number,sale.route_id,sale.inventory_location_id,sale.customer_id,
                  EXISTS(SELECT 1 FROM route_load rl WHERE rl.route_id=sale.route_id AND rl.status='STARTED') route_open
                FROM sale WHERE sale.id=:id AND sale.status='CONFIRMED' FOR UPDATE
                """).param("id",saleId).query((rs,row)->new SaleSnapshot(rs.getObject("id",UUID.class),
                rs.getString("document_number"),rs.getObject("route_id",UUID.class),
                rs.getObject("inventory_location_id",UUID.class),rs.getObject("customer_id",UUID.class),
                rs.getBoolean("route_open"),List.of(),List.of())).optional().orElseThrow(this::notFound);
        var items=jdbc.sql("""
                SELECT si.product_id,p.name product_name,si.quantity_base_units FROM sale_item si
                JOIN product p ON p.id=si.product_id WHERE si.sale_id=:id ORDER BY p.name
                """).param("id",saleId).query((rs,row)->new SaleItem(rs.getObject("product_id",UUID.class),
                rs.getString("product_name"),rs.getBigDecimal("quantity_base_units"))).list();
        var payments=jdbc.sql("SELECT id,payment_method,amount FROM payment WHERE sale_id=:id ORDER BY payment_method")
                .param("id",saleId).query((rs,row)->new Payment(rs.getObject("id",UUID.class),
                        rs.getString("payment_method"),rs.getBigDecimal("amount"))).list();
        return new SaleSnapshot(sale.saleId(),sale.documentNumber(),sale.routeId(),sale.routeLocationId(),
                sale.customerId(),sale.routeOpen(),items,payments);
    }
    @Override public AnnulmentView create(NewAnnulment item){
        jdbc.sql("""
                INSERT INTO annulment_request(id,sale_id,requested_by,requested_device_id,reason)
                VALUES (:id,:sale,:actor,:device,:reason)
                """).param("id",item.id()).param("sale",item.sale().saleId()).param("actor",item.requestedBy())
                .param("device",item.deviceId()).param("reason",item.reason()).update();
        audit(item.requestedBy(),item.deviceId(),"ANNULMENT_REQUEST",item.id(),"REQUESTED");
        return findForDecision(item.id());
    }
    @Override public AnnulmentView findForDecision(UUID id){
        return jdbc.sql(annulmentSelect()+" WHERE ar.id=:id FOR UPDATE OF ar").param("id",id)
                .query((rs,row)->annulmentRow(rs)).optional().map(this::withEffects).orElseThrow(this::notFound);
    }
    @Override public AnnulmentView decide(UUID id,String status,UUID actorId,UUID deviceId,String notes){
        int changed=jdbc.sql("""
                UPDATE annulment_request SET status=:status,decided_by=:actor,decided_device_id=:device,
                  decision_notes=:notes,decided_at=now() WHERE id=:id AND status='REQUESTED'
                """).param("status",status).param("actor",actorId).param("device",deviceId)
                .param("notes",notes).param("id",id).update();
        if(changed!=1)throw new BusinessException("ANNULMENT_CONCURRENT","La solicitud ya fue decidida.",ErrorCategory.CONFLICT);
        if("APPROVED".equals(status)){
            var request=jdbc.sql("SELECT sale_id FROM annulment_request WHERE id=:id").param("id",id).query(UUID.class).single();
            var payments=jdbc.sql("SELECT id,payment_method,amount FROM payment WHERE sale_id=:saleId FOR UPDATE")
                    .param("saleId",request).query((rs,row)->new Payment(rs.getObject("id",UUID.class),rs.getString("payment_method"),rs.getBigDecimal("amount"))).list();
            for(var payment:payments){
                jdbc.sql("""
                        INSERT INTO payment_reversal(id,annulment_request_id,payment_id,payment_method,amount,reversed_by,reversed_device_id)
                        VALUES (:id,:annulment,:payment,:method,:amount,:actor,:device)
                        """).param("id",UUID.randomUUID()).param("annulment",id).param("payment",payment.paymentId())
                        .param("method",payment.method()).param("amount",payment.amount()).param("actor",actorId)
                        .param("device",deviceId).update();
                if("CREDIT".equals(payment.method())) reverseCredit(request,payment,actorId,deviceId);
            }
        }
        audit(actorId,deviceId,"ANNULMENT_"+status,id,status);
        return findForDecision(id);
    }
    private void reverseCredit(UUID saleId,Payment payment,UUID actorId,UUID deviceId){
        var customer=jdbc.sql("SELECT c.id,c.current_balance FROM customer c JOIN sale s ON s.customer_id=c.id WHERE s.id=:saleId FOR UPDATE OF c")
                .param("saleId",saleId).query((rs,row)->new Object[]{rs.getObject("id",UUID.class),rs.getBigDecimal("current_balance")}).single();
        UUID customerId=(UUID)customer[0];BigDecimal before=(BigDecimal)customer[1];BigDecimal after=before.subtract(payment.amount());
        if(after.signum()<0)throw new BusinessException("ANNULMENT_CREDIT_BALANCE","El saldo de crédito no permite la reversión.",ErrorCategory.CONFLICT);
        jdbc.sql("UPDATE customer SET current_balance=:balance,updated_at=now() WHERE id=:id")
                .param("balance",after).param("id",customerId).update();
        jdbc.sql("""
                INSERT INTO credit_account_entry(id,customer_id,sale_id,payment_id,entry_type,amount,balance_after,created_by,device_id)
                VALUES (:id,:customer,:sale,:payment,'SALE_VOID',:amount,:balance,:actor,:device)
                """).param("id",UUID.randomUUID()).param("customer",customerId).param("sale",saleId)
                .param("payment",payment.paymentId()).param("amount",payment.amount()).param("balance",after)
                .param("actor",actorId).param("device",deviceId).update();
    }
    @Override public List<AnnulmentView> findAll(Optional<UUID> sellerUserId){
        String filter=sellerUserId.isPresent()?" WHERE seller.user_id=:user":"";
        var query=jdbc.sql(annulmentSelect()+filter+" ORDER BY ar.requested_at DESC");
        if(sellerUserId.isPresent())query=query.param("user",sellerUserId.get());
        return query.query((rs,row)->annulmentRow(rs)).list().stream().map(this::withEffects).toList();
    }
    private String annulmentSelect(){return """
            SELECT ar.*,sale.document_number,sale.route_id,r.code route_code,r.name route_name,c.name customer_name,
              sale.total sale_total,requester.username requested_username,decider.username decided_username
            FROM annulment_request ar JOIN sale ON sale.id=ar.sale_id JOIN route r ON r.id=sale.route_id
            JOIN customer c ON c.id=sale.customer_id JOIN seller ON seller.id=sale.seller_id
            JOIN app_user requester ON requester.id=ar.requested_by LEFT JOIN app_user decider ON decider.id=ar.decided_by
            """;}
    private AnnulmentView annulmentRow(ResultSet rs)throws SQLException{return new AnnulmentView(rs.getObject("id",UUID.class),
            rs.getObject("sale_id",UUID.class),rs.getString("document_number"),rs.getObject("route_id",UUID.class),
            rs.getString("route_code"),rs.getString("route_name"),rs.getString("customer_name"),rs.getBigDecimal("sale_total"),
            rs.getString("status"),rs.getString("reason"),rs.getObject("requested_by",UUID.class),rs.getString("requested_username"),
            rs.getObject("decided_by",UUID.class),rs.getString("decided_username"),rs.getString("decision_notes"),
            rs.getTimestamp("requested_at").toInstant(),rs.getTimestamp("decided_at")==null?null:rs.getTimestamp("decided_at").toInstant(),List.of());}
    private AnnulmentView withEffects(AnnulmentView item){
        var effects=new ArrayList<EffectView>();
        effects.addAll(jdbc.sql("SELECT payment_method,amount FROM payment_reversal WHERE annulment_request_id=:id ORDER BY payment_method")
                .param("id",item.id()).query((rs,row)->new EffectView("PAYMENT_REVERSAL",rs.getString("payment_method"),
                        rs.getBigDecimal("amount"),null,null,null)).list());
        effects.addAll(jdbc.sql("""
                SELECT im.product_id,p.name product_name,im.quantity_delta FROM inventory_movement im JOIN product p ON p.id=im.product_id
                WHERE im.reference_type='SALE_ANNULMENT' AND im.reference_id=:id ORDER BY p.name
                """).param("id",item.id()).query((rs,row)->new EffectView("INVENTORY_RESTORE",null,null,
                        rs.getObject("product_id",UUID.class),rs.getString("product_name"),rs.getBigDecimal("quantity_delta"))).list());
        return new AnnulmentView(item.id(),item.saleId(),item.documentNumber(),item.routeId(),item.routeCode(),item.routeName(),
                item.customerName(),item.saleTotal(),item.status(),item.reason(),item.requestedBy(),item.requestedByUsername(),
                item.decidedBy(),item.decidedByUsername(),item.decisionNotes(),item.requestedAt(),item.decidedAt(),effects);
    }
    private void audit(UUID user,UUID device,String action,UUID id,String status){jdbc.sql("""
            INSERT INTO audit_log(user_id,device_id,action,entity_type,entity_id,after_data,correlation_id)
            VALUES (:user,:device,:action,'ANNULMENT',:id,jsonb_build_object('status',:status),:correlation)
            """).param("user",user).param("device",device).param("action",action).param("id",id)
            .param("status",status).param("correlation",UUID.randomUUID()).update();}
    private BusinessException notFound(){return new BusinessException("ANNULMENT_NOT_FOUND","No se encontró la venta o solicitud.",ErrorCategory.NOT_FOUND);}
}
