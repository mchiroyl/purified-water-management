package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.PaymentPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcPaymentAdapter implements PaymentPort {
    private final JdbcClient jdbc;

    public JdbcPaymentAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<TransferView> findTransfers() {
        return jdbc.sql(selectTransfer() + " ORDER BY pay.created_at DESC")
                .query((rs, row) -> transfer(rs)).list();
    }

    @Override
    public Optional<TransferView> findTransfer(UUID id) {
        return jdbc.sql(selectTransfer() + " AND pay.id=:id FOR UPDATE OF pay")
                .param("id", id).query((rs, row) -> transfer(rs)).optional();
    }

    @Override
    public TransferView decideTransfer(UUID id, String status, UUID decidedBy, String rejectionReason) {
        int updated = jdbc.sql("""
                UPDATE payment SET status=:status,verified_by=:decidedBy,verified_at=now(),
                    rejection_reason=:rejectionReason
                WHERE id=:id AND payment_method='TRANSFER' AND status='PENDING_VERIFICATION'
                """).param("status", status).param("decidedBy", decidedBy)
                .param("rejectionReason", rejectionReason).param("id", id).update();
        if (updated != 1) {
            throw new BusinessException("TRANSFER_ALREADY_DECIDED", "La transferencia ya fue revisada.",
                    ErrorCategory.CONFLICT);
        }
        return findTransfer(id).orElseThrow();
    }

    private String selectTransfer() {
        return """
                SELECT pay.id,pay.sale_id,sale.document_number,sale.route_id,route.code route_code,
                       route.name route_name,sale.seller_id,seller.display_name seller_name,
                       sale.customer_id,customer.code customer_code,customer.name customer_name,
                       pay.amount,sale.currency_code,pay.status,pay.reference,pay.bank,pay.evidence_reference,
                       pay.registered_by,registrar.username registered_by_username,pay.device_id,
                       pay.verified_by,verifier.username verified_by_username,pay.verified_at,
                       pay.rejection_reason,pay.created_at
                FROM payment pay JOIN sale ON sale.id=pay.sale_id JOIN route ON route.id=sale.route_id
                JOIN seller ON seller.id=sale.seller_id JOIN customer ON customer.id=sale.customer_id
                JOIN app_user registrar ON registrar.id=pay.registered_by
                LEFT JOIN app_user verifier ON verifier.id=pay.verified_by
                WHERE pay.payment_method='TRANSFER'
                """;
    }

    private TransferView transfer(ResultSet rs) throws SQLException {
        return new TransferView(rs.getObject("id", UUID.class), rs.getObject("sale_id", UUID.class),
                rs.getString("document_number"), rs.getObject("route_id", UUID.class),
                rs.getString("route_code"), rs.getString("route_name"),
                rs.getObject("seller_id", UUID.class), rs.getString("seller_name"),
                rs.getObject("customer_id", UUID.class), rs.getString("customer_code"),
                rs.getString("customer_name"), rs.getBigDecimal("amount"), rs.getString("currency_code"),
                rs.getString("status"), rs.getString("reference"), rs.getString("bank"),
                rs.getString("evidence_reference"), rs.getObject("registered_by", UUID.class),
                rs.getString("registered_by_username"), rs.getObject("device_id", UUID.class),
                rs.getObject("verified_by", UUID.class), rs.getString("verified_by_username"),
                instant(rs, "verified_at"), rs.getString("rejection_reason"), instant(rs, "created_at"));
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
