package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.SalesPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcSalesAdapter implements SalesPort {
    private final JdbcClient jdbc;

    public JdbcSalesAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<SaleContext> findSaleContext(UUID routeId, UUID customerId) {
        return jdbc.sql("""
                SELECT r.id route_id,il.id inventory_location_id,rl.id route_load_id,ra.seller_id,c.customer_type,
                       c.credit_allowed,c.credit_limit,c.current_balance
                FROM route r
                JOIN inventory_location il ON il.route_id=r.id AND il.active AND il.location_type='ROUTE'
                JOIN LATERAL (
                    SELECT id FROM route_load WHERE route_id=r.id AND status='STARTED'
                    ORDER BY started_at DESC LIMIT 1
                ) rl ON true
                JOIN LATERAL (
                    SELECT seller_id FROM route_assignment current_ra WHERE current_ra.route_id=r.id
                      AND current_ra.valid_from<=current_date
                      AND (current_ra.valid_to IS NULL OR current_ra.valid_to>=current_date)
                    ORDER BY current_ra.valid_from DESC LIMIT 1
                ) ra ON true
                JOIN customer_route cr ON cr.route_id=r.id AND cr.customer_id=:customerId
                  AND cr.valid_from<=current_date AND (cr.valid_to IS NULL OR cr.valid_to>=current_date)
                JOIN customer c ON c.id=cr.customer_id AND c.status='ACTIVE'
                  AND c.registration_state IN ('ACTIVE','PENDING_REVIEW')
                WHERE r.id=:routeId AND r.status='ACTIVE'
                FOR UPDATE OF c
                """).param("routeId", routeId).param("customerId", customerId)
                .query((rs, row) -> new SaleContext(rs.getObject("route_id", UUID.class),
                        rs.getObject("inventory_location_id", UUID.class),
                        rs.getObject("route_load_id", UUID.class),
                        rs.getObject("seller_id", UUID.class), rs.getString("customer_type"),
                        rs.getBoolean("credit_allowed"), rs.getBigDecimal("credit_limit"),
                        rs.getBigDecimal("current_balance"))).optional();
    }

    @Override
    public boolean sellerAssignedToRoute(UUID userId, UUID routeId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM route_assignment ra JOIN seller s ON s.id=ra.seller_id
                WHERE ra.route_id=:routeId AND s.user_id=:userId AND s.status='ACTIVE'
                  AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date))
                """).param("routeId", routeId).param("userId", userId).query(Boolean.class).single());
    }

    @Override
    public Optional<PresentationView> findActivePresentation(UUID presentationId) {
        return jdbc.sql("""
                SELECT pp.id presentation_id,pp.code presentation_code,pp.name presentation_name,
                       p.id product_id,p.code product_code,p.name product_name,pc.conversion_factor
                FROM product_presentation pp JOIN product p ON p.id=pp.product_id
                JOIN presentation_conversion pc ON pc.presentation_id=pp.id AND pc.valid_to IS NULL
                WHERE pp.id=:id AND pp.active AND p.active AND p.controls_inventory
                """).param("id", presentationId).query((rs, row) -> new PresentationView(
                rs.getObject("presentation_id", UUID.class), rs.getString("presentation_code"),
                rs.getString("presentation_name"), rs.getObject("product_id", UUID.class),
                rs.getString("product_code"), rs.getString("product_name"),
                rs.getBigDecimal("conversion_factor"))).optional();
    }

    @Override
    public SaleView createSale(NewSale item) {
        var company = jdbc.sql("""
                SELECT id,commercial_name,legal_name,tax_id,address,phone,whatsapp,email,timezone,logo_file_id,
                       currency_code,receipt_prefix,next_receipt_number,document_legend
                FROM company_configuration ORDER BY created_at LIMIT 1 FOR UPDATE
                """).query((rs, row) -> new CompanyNumber(rs.getObject("id", UUID.class),
                rs.getString("commercial_name"), rs.getString("legal_name"), rs.getString("tax_id"),
                rs.getString("address"), rs.getString("phone"), rs.getString("whatsapp"), rs.getString("email"),
                rs.getString("timezone"), rs.getObject("logo_file_id", UUID.class),
                rs.getString("currency_code"), rs.getString("receipt_prefix"),
                rs.getLong("next_receipt_number"), rs.getString("document_legend"))).optional()
                .orElseThrow(() -> new BusinessException("COMPANY_CONFIGURATION_REQUIRED",
                        "Debe configurar los datos de la empresa antes de registrar ventas.",
                        ErrorCategory.VALIDATION));
        String documentNumber = company.receiptPrefix() + "-" + "%08d".formatted(company.nextNumber());
        jdbc.sql("UPDATE company_configuration SET next_receipt_number=next_receipt_number+1,version=version+1 WHERE id=:id")
                .param("id", company.id()).update();
        jdbc.sql("""
                INSERT INTO sale(id,client_reference,document_number,receipt_sequence_number,route_id,
                    inventory_location_id,seller_id,customer_id,subtotal,total,currency_code,company_name,
                    company_tax_id,company_address,company_legal_name,company_phone,company_whatsapp,company_email,
                    company_timezone,company_logo_file_id,document_legend,created_by,device_id)
                VALUES (:id,:clientReference,:documentNumber,:sequence,:routeId,:locationId,:sellerId,:customerId,
                    :subtotal,:total,:currency,:companyName,:companyTaxId,:companyAddress,:legalName,:phone,:whatsapp,
                    :email,:timezone,:logoFileId,:legend,:createdBy,:deviceId)
                """).param("id", item.id()).param("clientReference", item.clientReference())
                .param("documentNumber", documentNumber).param("sequence", company.nextNumber())
                .param("routeId", item.routeId()).param("locationId", item.inventoryLocationId())
                .param("sellerId", item.sellerId()).param("customerId", item.customerId())
                .param("subtotal", item.subtotal()).param("total", item.total()).param("currency", company.currencyCode())
                .param("companyName", company.commercialName()).param("companyTaxId", company.taxId())
                .param("companyAddress", company.address()).param("legalName", company.legalName())
                .param("phone", company.phone()).param("whatsapp", company.whatsapp()).param("email", company.email())
                .param("timezone", company.timezone()).param("logoFileId", company.logoFileId(), Types.OTHER)
                .param("legend", company.documentLegend())
                .param("createdBy", item.createdBy()).param("deviceId", item.deviceId()).update();
        for (var row : item.items()) {
            jdbc.sql("""
                    INSERT INTO sale_item(id,sale_id,product_id,presentation_id,presentation_quantity,
                        quantity_base_units,unit_price,line_total,price_source,price_version_id,price_tier_id,special_price_id)
                    VALUES (:id,:saleId,:productId,:presentationId,:presentationQuantity,:baseUnits,:unitPrice,
                        :lineTotal,:priceSource,:priceVersionId,:priceTierId,:specialPriceId)
                    """).param("id", row.id()).param("saleId", item.id()).param("productId", row.productId())
                    .param("presentationId", row.presentationId()).param("presentationQuantity", row.presentationQuantity())
                    .param("baseUnits", row.quantityBaseUnits()).param("unitPrice", row.unitPrice())
                    .param("lineTotal", row.lineTotal()).param("priceSource", row.priceSource())
                    .param("priceVersionId", row.priceVersionId(), Types.OTHER)
                    .param("priceTierId", row.priceTierId(), Types.OTHER)
                    .param("specialPriceId", row.specialPriceId(), Types.OTHER).update();
        }
        for (var payment : item.payments()) {
            jdbc.sql("""
                    INSERT INTO payment(id,sale_id,payment_method,amount,status,reference,bank,evidence_reference,
                        registered_by,device_id)
                    VALUES (:id,:saleId,:method,:amount,:status,:reference,:bank,:evidence,:registeredBy,:deviceId)
                    """).param("id", payment.id()).param("saleId", item.id()).param("method", payment.method())
                    .param("amount", payment.amount()).param("status", payment.status())
                    .param("reference", payment.reference()).param("bank", payment.bank())
                    .param("evidence", payment.evidenceReference()).param("registeredBy", item.createdBy())
                    .param("deviceId", item.deviceId()).update();
            if ("CREDIT".equals(payment.method())) {
                var balanceAfter = jdbc.sql("""
                        UPDATE customer SET current_balance=current_balance+:amount,updated_at=now()
                        WHERE id=:customerId AND customer_type='PERMANENT' AND credit_allowed
                          AND current_balance+:amount<=credit_limit
                        RETURNING current_balance
                        """).param("amount", payment.amount()).param("customerId", item.customerId())
                        .query(BigDecimal.class).optional().orElseThrow(() -> new BusinessException(
                                "CREDIT_LIMIT_EXCEEDED", "El crédito excede el límite disponible del cliente.",
                                ErrorCategory.VALIDATION));
                jdbc.sql("""
                        INSERT INTO credit_account_entry(id,customer_id,sale_id,payment_id,entry_type,amount,
                            balance_after,created_by,device_id)
                        VALUES (:id,:customerId,:saleId,:paymentId,'SALE_CHARGE',:amount,:balanceAfter,
                            :createdBy,:deviceId)
                        """).param("id", UUID.randomUUID()).param("customerId", item.customerId())
                        .param("saleId", item.id()).param("paymentId", payment.id())
                        .param("amount", payment.amount()).param("balanceAfter", balanceAfter)
                        .param("createdBy", item.createdBy()).param("deviceId", item.deviceId()).update();
            }
        }
        return findSale(item.id(), Optional.empty()).orElseThrow();
    }

    @Override
    public List<SaleView> findSales(Optional<UUID> sellerUserId) {
        String filter = sellerUserId.isPresent() ? " AND seller.user_id=:sellerUserId" : "";
        var statement = jdbc.sql(saleSelect() + filter + " ORDER BY s.created_at DESC");
        if (sellerUserId.isPresent()) statement = statement.param("sellerUserId", sellerUserId.get());
        return statement.query((rs, row) -> saleRow(rs)).list().stream().map(this::withItems).toList();
    }

    @Override
    public Optional<SaleView> findSale(UUID id, Optional<UUID> sellerUserId) {
        String filter = sellerUserId.isPresent() ? " AND seller.user_id=:sellerUserId" : "";
        var statement = jdbc.sql(saleSelect() + " AND s.id=:id" + filter).param("id", id);
        if (sellerUserId.isPresent()) statement = statement.param("sellerUserId", sellerUserId.get());
        return statement.query((rs, row) -> saleRow(rs)).optional().map(this::withItems);
    }

    private SaleView withItems(SaleView sale) {
        var items = jdbc.sql("""
                SELECT si.id,si.product_id,p.code product_code,p.name product_name,si.presentation_id,
                       pp.code presentation_code,pp.name presentation_name,si.presentation_quantity,
                       si.quantity_base_units,si.unit_price,si.line_total,si.price_source,
                       si.price_version_id,si.price_tier_id,si.special_price_id
                FROM sale_item si JOIN product p ON p.id=si.product_id
                JOIN product_presentation pp ON pp.id=si.presentation_id
                WHERE si.sale_id=:id ORDER BY p.name,pp.name
                """).param("id", sale.id()).query((rs, row) -> new SaleItemView(rs.getObject("id", UUID.class),
                rs.getObject("product_id", UUID.class), rs.getString("product_code"), rs.getString("product_name"),
                rs.getObject("presentation_id", UUID.class), rs.getString("presentation_code"),
                rs.getString("presentation_name"), rs.getBigDecimal("presentation_quantity"),
                rs.getBigDecimal("quantity_base_units"), rs.getBigDecimal("unit_price"),
                rs.getBigDecimal("line_total"), rs.getString("price_source"),
                rs.getObject("price_version_id", UUID.class), rs.getObject("price_tier_id", UUID.class),
                rs.getObject("special_price_id", UUID.class))).list();
        var payments = jdbc.sql("""
                SELECT pay.id,pay.payment_method,pay.amount,pay.status,pay.reference,pay.bank,
                       pay.evidence_reference,pay.registered_by,registrar.username registered_by_username,
                       pay.verified_by,verifier.username verified_by_username,pay.verified_at,
                       pay.rejection_reason,pay.created_at
                FROM payment pay JOIN app_user registrar ON registrar.id=pay.registered_by
                LEFT JOIN app_user verifier ON verifier.id=pay.verified_by
                WHERE pay.sale_id=:id ORDER BY pay.created_at,pay.payment_method
                """).param("id", sale.id()).query((rs, row) -> new PaymentView(
                rs.getObject("id", UUID.class), rs.getString("payment_method"), rs.getBigDecimal("amount"),
                rs.getString("status"), rs.getString("reference"), rs.getString("bank"),
                rs.getString("evidence_reference"), rs.getObject("registered_by", UUID.class),
                rs.getString("registered_by_username"), rs.getObject("verified_by", UUID.class),
                rs.getString("verified_by_username"), instant(rs, "verified_at"),
                rs.getString("rejection_reason"), instant(rs, "created_at"))).list();
        return new SaleView(sale.id(), sale.clientReference(), sale.documentNumber(), sale.routeId(),
                sale.routeCode(), sale.routeName(), sale.inventoryLocationId(), sale.sellerId(), sale.sellerName(),
                sale.customerId(), sale.customerCode(), sale.customerName(), sale.status(), sale.subtotal(),
                sale.total(), sale.currencyCode(), sale.companyName(), sale.companyTaxId(), sale.companyAddress(),
                sale.documentLegend(), sale.createdBy(), sale.createdByUsername(), sale.deviceId(), sale.createdAt(),
                items, payments);
    }

    private String saleSelect() {
        return """
                SELECT s.id,s.client_reference,s.document_number,s.route_id,r.code route_code,r.name route_name,
                       s.inventory_location_id,s.seller_id,seller.display_name seller_name,s.customer_id,
                       c.code customer_code,c.name customer_name,s.status,s.subtotal,s.total,s.currency_code,
                       s.company_name,s.company_tax_id,s.company_address,s.document_legend,s.created_by,
                       creator.username created_by_username,s.device_id,s.created_at
                FROM sale s JOIN route r ON r.id=s.route_id JOIN seller ON seller.id=s.seller_id
                JOIN customer c ON c.id=s.customer_id JOIN app_user creator ON creator.id=s.created_by WHERE 1=1
                """;
    }

    private SaleView saleRow(ResultSet rs) throws SQLException {
        return new SaleView(rs.getObject("id", UUID.class), rs.getObject("client_reference", UUID.class),
                rs.getString("document_number"), rs.getObject("route_id", UUID.class), rs.getString("route_code"),
                rs.getString("route_name"), rs.getObject("inventory_location_id", UUID.class),
                rs.getObject("seller_id", UUID.class), rs.getString("seller_name"),
                rs.getObject("customer_id", UUID.class), rs.getString("customer_code"), rs.getString("customer_name"),
                rs.getString("status"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("total"),
                rs.getString("currency_code"), rs.getString("company_name"), rs.getString("company_tax_id"),
                rs.getString("company_address"), rs.getString("document_legend"),
                rs.getObject("created_by", UUID.class), rs.getString("created_by_username"),
                rs.getObject("device_id", UUID.class), instant(rs, "created_at"), List.of(), List.of());
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private record CompanyNumber(UUID id, String commercialName, String legalName, String taxId, String address,
                                 String phone, String whatsapp, String email, String timezone, UUID logoFileId,
                                 String currencyCode, String receiptPrefix, long nextNumber,
                                 String documentLegend) {
    }
}
