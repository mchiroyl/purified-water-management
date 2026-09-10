package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.PricingPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.pricing.PricePolicy;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcPricingAdapter implements PricingPort {
    private final JdbcClient jdbc;
    public JdbcPricingAdapter(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public String nextPriceListCode() { return jdbc.sql("SELECT 'LST-' || LPAD(nextval('price_list_code_seq')::text, 4, '0')").query(String.class).single(); }
    @Override public boolean priceListCodeExists(String code) { return exists("SELECT EXISTS(SELECT 1 FROM price_list WHERE code=:value)", code); }
    @Override public boolean presentationExists(UUID id) { return exists("SELECT EXISTS(SELECT 1 FROM product_presentation WHERE id=:value AND active)", id); }
    @Override public boolean customerEligibleForBenefits(UUID id) {
        return exists("""
                SELECT EXISTS(SELECT 1 FROM customer WHERE id=:value AND customer_type='PERMANENT'
                    AND status='ACTIVE' AND registration_state='ACTIVE')
                """, id);
    }

    @Override
    public PriceListView createPriceList(NewPriceList item) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO price_list(id, code, name, currency_code) VALUES (:id,:code,:name,:currency)")
                .param("id", id).param("code", item.code()).param("name", item.name())
                .param("currency", item.currencyCode()).update();
        return findPriceList(id);
    }

    @Override
    public List<PriceListView> findPriceLists() {
        return jdbc.sql("SELECT id,code,name,status,currency_code FROM price_list ORDER BY name,code")
                .query((rs, row) -> priceListRow(rs)).list().stream().map(this::withVersions).toList();
    }

    @Override
    public int nextVersionNumber(UUID listId) {
        if (!exists("SELECT EXISTS(SELECT 1 FROM price_list WHERE id=:value)", listId)) throw notFound("PRICE_LIST_NOT_FOUND", "No se encontró la lista de precios.");
        return jdbc.sql("SELECT COALESCE(max(version_number),0)+1 FROM price_version WHERE price_list_id=:id")
                .param("id", listId).query(Integer.class).single();
    }

    @Override
    public PriceListView createPriceVersion(NewPriceVersion item) {
        UUID versionId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO price_version(id,price_list_id,version_number,valid_from,status,created_by)
                VALUES (:id,:listId,:versionNumber,:validFrom,'DRAFT',:createdBy)
                """).param("id", versionId).param("listId", item.priceListId())
                .param("versionNumber", item.versionNumber())
                .param("validFrom", timestamp(item.validFrom()), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("createdBy", item.createdBy()).update();
        for (var tier : item.tiers()) {
            jdbc.sql("""
                    INSERT INTO price_tier(id,price_version_id,product_presentation_id,min_base_units,max_base_units,unit_price)
                    VALUES (:id,:versionId,:presentationId,:minimum,:maximum,:price)
                    """).param("id", UUID.randomUUID()).param("versionId", versionId)
                    .param("presentationId", tier.presentationId()).param("minimum", tier.minimumBaseUnits())
                    .param("maximum", tier.maximumBaseUnits(), Types.NUMERIC).param("price", tier.unitPrice()).update();
        }
        return findPriceList(item.priceListId());
    }

    @Override
    public PriceListView activatePriceVersion(UUID versionId, Instant now) {
        var target = jdbc.sql("SELECT price_list_id,valid_from,status FROM price_version WHERE id=:id")
                .param("id", versionId).query((rs, row) -> new VersionTarget(rs.getObject("price_list_id", UUID.class),
                        instant(rs, "valid_from"), rs.getString("status"))).optional()
                .orElseThrow(() -> notFound("PRICE_VERSION_NOT_FOUND", "No se encontró la versión de precios."));
        if (!List.of("DRAFT", "SCHEDULED").contains(target.status())) {
            throw conflict("PRICE_VERSION_IMMUTABLE", "La versión ya fue activada y es inmutable.");
        }
        if (target.validFrom().isAfter(now)) {
            jdbc.sql("UPDATE price_version SET valid_to=:validFrom WHERE price_list_id=:listId AND status='ACTIVE' AND valid_to IS NULL")
                    .param("validFrom", timestamp(target.validFrom()), Types.TIMESTAMP_WITH_TIMEZONE)
                    .param("listId", target.listId()).update();
            jdbc.sql("UPDATE price_version SET status='SCHEDULED' WHERE id=:id").param("id", versionId).update();
        } else {
            jdbc.sql("UPDATE price_version SET status='INACTIVE',valid_to=:now WHERE price_list_id=:listId AND status='ACTIVE'")
                    .param("now", timestamp(now), Types.TIMESTAMP_WITH_TIMEZONE).param("listId", target.listId()).update();
            jdbc.sql("UPDATE price_version SET status='ACTIVE' WHERE id=:id").param("id", versionId).update();
        }
        return findPriceList(target.listId());
    }

    @Override
    public SpecialPriceView createSpecialPrice(NewSpecialPrice item) {
        jdbc.sql("""
                UPDATE customer_special_price SET valid_to=:validFrom,
                    status=CASE WHEN :validFrom <= now() THEN 'INACTIVE' ELSE status END
                WHERE customer_id=:customerId AND product_presentation_id=:presentationId
                  AND status='ACTIVE' AND valid_to IS NULL AND valid_from < :validFrom
                """).param("validFrom", timestamp(item.validFrom()), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("customerId", item.customerId())
                .param("presentationId", item.presentationId()).update();
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO customer_special_price(id,customer_id,product_presentation_id,unit_price,valid_from,valid_to,approved_by)
                VALUES (:id,:customerId,:presentationId,:unitPrice,:validFrom,:validTo,:approvedBy)
                """).param("id", id).param("customerId", item.customerId()).param("presentationId", item.presentationId())
                .param("unitPrice", item.unitPrice())
                .param("validFrom", timestamp(item.validFrom()), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("validTo", timestamp(item.validTo()), Types.TIMESTAMP_WITH_TIMEZONE).param("approvedBy", item.approvedBy()).update();
        return findSpecialPriceView(id);
    }

    @Override
    public List<SpecialPriceView> findSpecialPrices() {
        return jdbc.sql(specialSelect() + " ORDER BY sp.valid_from DESC")
                .query((rs, row) -> specialRow(rs)).list();
    }

    @Override
    public Optional<PricePolicy.SpecialPrice> findSpecialPrice(UUID customerId, UUID presentationId, Instant at) {
        return jdbc.sql("""
                SELECT sp.id,sp.unit_price FROM customer_special_price sp
                JOIN customer c ON c.id=sp.customer_id AND c.customer_type='PERMANENT'
                  AND c.status='ACTIVE' AND c.registration_state='ACTIVE'
                WHERE sp.customer_id=:customerId AND sp.product_presentation_id=:presentationId AND sp.status='ACTIVE'
                  AND sp.valid_from<=:at AND (sp.valid_to IS NULL OR sp.valid_to>:at)
                ORDER BY sp.valid_from DESC LIMIT 1
                """).param("customerId", customerId).param("presentationId", presentationId)
                .param("at", timestamp(at), Types.TIMESTAMP_WITH_TIMEZONE)
                .query((rs, row) -> new PricePolicy.SpecialPrice(rs.getObject("id", UUID.class), rs.getBigDecimal("unit_price"))).optional();
    }

    @Override
    public List<PricePolicy.Tier> findApplicableTiers(UUID presentationId, Instant at) {
        return jdbc.sql("""
                SELECT pt.id,pt.price_version_id,pt.min_base_units,pt.max_base_units,pt.unit_price
                FROM price_tier pt
                JOIN price_version pv ON pv.id=pt.price_version_id
                JOIN price_list pl ON pl.id=pv.price_list_id
                WHERE pt.product_presentation_id=:presentationId AND pl.status='ACTIVE'
                  AND pv.status IN ('ACTIVE','SCHEDULED') AND pv.valid_from<=:at
                  AND (pv.valid_to IS NULL OR pv.valid_to>:at)
                  AND pv.id=(
                    SELECT pv2.id FROM price_version pv2 JOIN price_list pl2 ON pl2.id=pv2.price_list_id
                    JOIN price_tier pt2 ON pt2.price_version_id=pv2.id
                    WHERE pt2.product_presentation_id=:presentationId AND pl2.status='ACTIVE'
                      AND pv2.status IN ('ACTIVE','SCHEDULED') AND pv2.valid_from<=:at
                      AND (pv2.valid_to IS NULL OR pv2.valid_to>:at)
                    ORDER BY pv2.valid_from DESC LIMIT 1)
                ORDER BY pt.min_base_units
                """).param("presentationId", presentationId)
                .param("at", timestamp(at), Types.TIMESTAMP_WITH_TIMEZONE)
                .query((rs, row) -> new PricePolicy.Tier(rs.getObject("id", UUID.class),
                        rs.getObject("price_version_id", UUID.class), rs.getBigDecimal("min_base_units"),
                        rs.getBigDecimal("max_base_units"), rs.getBigDecimal("unit_price"))).list();
    }

    @Override
    public DiscountView createDiscount(NewDiscount item) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO discount_request(id,requested_by,customer_id,product_presentation_id,normal_price,
                    requested_price,reason,expires_at)
                VALUES (:id,:requestedBy,:customerId,:presentationId,:normalPrice,:requestedPrice,:reason,:expiresAt)
                """).param("id", id).param("requestedBy", item.requestedBy()).param("customerId", item.customerId())
                .param("presentationId", item.presentationId()).param("normalPrice", item.normalPrice())
                .param("requestedPrice", item.requestedPrice()).param("reason", item.reason())
                .param("expiresAt", timestamp(item.expiresAt()), Types.TIMESTAMP_WITH_TIMEZONE).update();
        return findDiscount(id).orElseThrow();
    }

    @Override public List<DiscountView> findDiscounts() {
        expireDiscounts();
        return jdbc.sql(discountSelect() + " ORDER BY dr.created_at DESC").query((rs, row) -> discountRow(rs)).list();
    }
    @Override public Optional<DiscountView> findDiscount(UUID id) {
        expireDiscounts();
        return jdbc.sql(discountSelect() + " AND dr.id=:id").param("id", id).query((rs, row) -> discountRow(rs)).optional();
    }
    @Override public DiscountView decideDiscount(UUID id, String decision, UUID actorId, Instant decidedAt) {
        int changed = jdbc.sql("""
                UPDATE discount_request SET status=:decision,approved_by=:actorId,decided_at=:decidedAt
                WHERE id=:id AND status='REQUESTED'
                """).param("decision", decision).param("actorId", actorId)
                .param("decidedAt", timestamp(decidedAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("id", id).update();
        if (changed != 1) throw conflict("DISCOUNT_ALREADY_DECIDED", "La solicitud ya no está pendiente.");
        return findDiscount(id).orElseThrow();
    }

    private PriceListView findPriceList(UUID id) {
        return jdbc.sql("SELECT id,code,name,status,currency_code FROM price_list WHERE id=:id").param("id", id)
                .query((rs, row) -> priceListRow(rs)).optional().map(this::withVersions)
                .orElseThrow(() -> notFound("PRICE_LIST_NOT_FOUND", "No se encontró la lista de precios."));
    }
    private PriceListView priceListRow(ResultSet rs) throws SQLException {
        return new PriceListView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("status"), rs.getString("currency_code"), List.of());
    }
    private PriceListView withVersions(PriceListView list) {
        var versions = jdbc.sql("""
                SELECT id,version_number,valid_from,valid_to,status FROM price_version
                WHERE price_list_id=:id ORDER BY version_number DESC
                """).param("id", list.id()).query((rs, row) -> new PriceVersionView(rs.getObject("id", UUID.class),
                rs.getInt("version_number"), instant(rs, "valid_from"), instant(rs, "valid_to"),
                rs.getString("status"), List.of())).list().stream().map(this::withTiers).toList();
        return new PriceListView(list.id(), list.code(), list.name(), list.status(), list.currencyCode(), versions);
    }
    private PriceVersionView withTiers(PriceVersionView version) {
        var tiers = jdbc.sql("""
                SELECT pt.id,pp.id presentation_id,pp.code presentation_code,pp.name presentation_name,
                       pt.min_base_units,pt.max_base_units,pt.unit_price
                FROM price_tier pt JOIN product_presentation pp ON pp.id=pt.product_presentation_id
                WHERE pt.price_version_id=:id ORDER BY pp.name,pt.min_base_units
                """).param("id", version.id()).query((rs, row) -> new TierView(rs.getObject("id", UUID.class),
                rs.getObject("presentation_id", UUID.class), rs.getString("presentation_code"),
                rs.getString("presentation_name"), rs.getBigDecimal("min_base_units"),
                rs.getBigDecimal("max_base_units"), rs.getBigDecimal("unit_price"))).list();
        return new PriceVersionView(version.id(), version.versionNumber(), version.validFrom(), version.validTo(), version.status(), tiers);
    }

    private SpecialPriceView findSpecialPriceView(UUID id) {
        return jdbc.sql(specialSelect() + " AND sp.id=:id").param("id", id).query((rs, row) -> specialRow(rs)).single();
    }
    private String specialSelect() { return """
            SELECT sp.id,sp.customer_id,c.code customer_code,c.name customer_name,
                   sp.product_presentation_id,pp.code presentation_code,pp.name presentation_name,
                   sp.unit_price,sp.valid_from,sp.valid_to,sp.status
            FROM customer_special_price sp JOIN customer c ON c.id=sp.customer_id
            JOIN product_presentation pp ON pp.id=sp.product_presentation_id WHERE 1=1
            """; }
    private SpecialPriceView specialRow(ResultSet rs) throws SQLException {
        return new SpecialPriceView(rs.getObject("id", UUID.class), rs.getObject("customer_id", UUID.class),
                rs.getString("customer_code"), rs.getString("customer_name"),
                rs.getObject("product_presentation_id", UUID.class), rs.getString("presentation_code"),
                rs.getString("presentation_name"), rs.getBigDecimal("unit_price"), instant(rs, "valid_from"),
                instant(rs, "valid_to"), rs.getString("status"));
    }

    private String discountSelect() { return """
            SELECT dr.id,dr.requested_by,u.username requester_username,dr.approved_by,dr.customer_id,
                   c.name customer_name,dr.product_presentation_id,pp.name presentation_name,dr.normal_price,
                   dr.requested_price,dr.reason,dr.status,dr.expires_at,dr.decided_at,dr.created_at
            FROM discount_request dr JOIN app_user u ON u.id=dr.requested_by JOIN customer c ON c.id=dr.customer_id
            JOIN product_presentation pp ON pp.id=dr.product_presentation_id WHERE 1=1
            """; }
    private DiscountView discountRow(ResultSet rs) throws SQLException {
        return new DiscountView(rs.getObject("id", UUID.class), rs.getObject("requested_by", UUID.class),
                rs.getString("requester_username"), rs.getObject("approved_by", UUID.class),
                rs.getObject("customer_id", UUID.class), rs.getString("customer_name"),
                rs.getObject("product_presentation_id", UUID.class), rs.getString("presentation_name"),
                rs.getBigDecimal("normal_price"), rs.getBigDecimal("requested_price"), rs.getString("reason"),
                rs.getString("status"), instant(rs, "expires_at"), instant(rs, "decided_at"), instant(rs, "created_at"));
    }
    private void expireDiscounts() {
        jdbc.sql("UPDATE discount_request SET status='EXPIRED',decided_at=now() WHERE status='REQUESTED' AND expires_at<=now()").update();
    }
    private boolean exists(String sql, Object value) { return Boolean.TRUE.equals(jdbc.sql(sql).param("value", value).query(Boolean.class).single()); }
    private Instant instant(ResultSet rs, String column) throws SQLException { var value=rs.getTimestamp(column); return value==null?null:value.toInstant(); }
    private OffsetDateTime timestamp(Instant value) { return value == null ? null : value.atOffset(ZoneOffset.UTC); }
    private BusinessException notFound(String code,String message){return new BusinessException(code,message,ErrorCategory.NOT_FOUND);}
    private BusinessException conflict(String code,String message){return new BusinessException(code,message,ErrorCategory.CONFLICT);}
    private record VersionTarget(UUID listId, Instant validFrom, String status) {}
}
