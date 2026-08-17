package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.ProductCatalogPersistencePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcProductCatalogAdapter implements ProductCatalogPersistencePort {

    private final JdbcClient jdbc;

    public JdbcProductCatalogAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean unitExists(String code) {
        return Boolean.TRUE.equals(jdbc.sql("SELECT EXISTS(SELECT 1 FROM unit_of_measure WHERE code = :code AND active)")
                .param("code", code).query(Boolean.class).single());
    }

    @Override
    public boolean productCodeExists(String code) {
        return Boolean.TRUE.equals(jdbc.sql("SELECT EXISTS(SELECT 1 FROM product WHERE code = :code)")
                .param("code", code).query(Boolean.class).single());
    }

    @Override
    public String nextProductCode() {
        return jdbc.sql("SELECT 'PRD-' || LPAD(nextval('product_code_seq')::text, 4, '0')")
                .query(String.class).single();
    }

    @Override
    public String nextPresentationCode() {
        return jdbc.sql("SELECT 'PRE-' || LPAD(nextval('presentation_code_seq')::text, 4, '0')")
                .query(String.class).single();
    }

    @Override
    public CatalogPresentationTemplate createPresentationTemplate(NewPresentationTemplate presentation) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO presentation_catalog(id, code, name, presentation_type, content_quantity, content_unit, unit_id, conversion_factor)
                VALUES (:id, :code, :name, :presentationType, :contentQuantity, :contentUnit, :unitId, :factor)
                """).params(Map.of("id", id, "code", presentation.code(), "name", presentation.name(),
                "presentationType", presentation.presentationType(), "contentQuantity", presentation.contentQuantity(),
                "contentUnit", presentation.contentUnit(), "unitId", unitId(presentation.unitCode()),
                "factor", presentation.conversionFactor())).update();
        return findPresentationTemplatesByIds(List.of(id)).getFirst();
    }

    @Override
    public CatalogPresentationTemplate updatePresentationTemplate(UUID id, NewPresentationTemplate presentation) {
        int changed = jdbc.sql("""
                UPDATE presentation_catalog SET name=:name,presentation_type=:presentationType,content_quantity=:contentQuantity,
                content_unit=:contentUnit,unit_id=:unitId,conversion_factor=:factor,updated_at=now()
                WHERE id=:id
                """).params(Map.of("id", id, "name", presentation.name(), "presentationType", presentation.presentationType(),
                "contentQuantity", presentation.contentQuantity(), "contentUnit", presentation.contentUnit(),
                "unitId", unitId(presentation.unitCode()), "factor", presentation.conversionFactor())).update();
        if (changed != 1) throw new BusinessException("PRESENTATION_NOT_FOUND", "La presentación no existe.", ErrorCategory.NOT_FOUND);
        return findPresentationTemplatesByIds(List.of(id)).getFirst();
    }

    @Override
    public CatalogPresentationTemplate setPresentationTemplateActive(UUID id, boolean active) {
        int changed = jdbc.sql("UPDATE presentation_catalog SET active=:active,updated_at=now() WHERE id=:id")
                .param("id", id).param("active", active).update();
        if (changed != 1) throw new BusinessException("PRESENTATION_NOT_FOUND", "La presentación no existe.", ErrorCategory.NOT_FOUND);
        return jdbc.sql("""
                SELECT pc.id,pc.code,pc.name,pc.presentation_type,pc.content_quantity,pc.content_unit,u.code unit_code,pc.conversion_factor,pc.active
                FROM presentation_catalog pc JOIN unit_of_measure u ON u.id=pc.unit_id WHERE pc.id=:id
                """).param("id", id).query((rs, row) -> templateRow(rs)).single();
    }

    @Override
    public void deletePresentationTemplate(UUID id) {
        if (jdbc.sql("DELETE FROM presentation_catalog WHERE id=:id").param("id", id).update() != 1) {
            throw new BusinessException("PRESENTATION_NOT_FOUND", "La presentación no existe.", ErrorCategory.NOT_FOUND);
        }
    }

    @Override
    public List<CatalogPresentationTemplate> findPresentationTemplates(String query) {
        String filter = query == null ? "" : query.trim().toUpperCase();
        return jdbc.sql("""
                SELECT pc.id,pc.code,pc.name,pc.presentation_type,pc.content_quantity,pc.content_unit,u.code unit_code,pc.conversion_factor,pc.active
                FROM presentation_catalog pc JOIN unit_of_measure u ON u.id=pc.unit_id
                WHERE pc.active AND (:filter='' OR upper(pc.code) LIKE '%' || :filter || '%'
                   OR upper(pc.name) LIKE '%' || :filter || '%' OR upper(pc.presentation_type) LIKE '%' || :filter || '%'
                   OR upper(pc.content_unit) LIKE '%' || :filter || '%' OR upper(u.code) LIKE '%' || :filter || '%')
                ORDER BY pc.name,pc.code
                """).param("filter", filter).query((rs, row) -> templateRow(rs)).list();
    }

    @Override
    public List<CatalogPresentationTemplate> findPresentationTemplatesByIds(List<UUID> ids) {
        if (ids.isEmpty()) return List.of();
        return jdbc.sql("""
                SELECT pc.id,pc.code,pc.name,pc.presentation_type,pc.content_quantity,pc.content_unit,u.code unit_code,pc.conversion_factor,pc.active
                FROM presentation_catalog pc JOIN unit_of_measure u ON u.id=pc.unit_id
                WHERE pc.active AND pc.id IN (:ids)
                """).param("ids", ids).query((rs, row) -> templateRow(rs)).list();
    }

    @Override
    public CatalogProduct create(NewProduct product) {
        UUID productId = UUID.randomUUID();
        UUID baseUnitId = unitId(product.baseUnitCode());
        jdbc.sql("""
                INSERT INTO product(id, code, name, description, base_unit_id, controls_inventory)
                VALUES (:id, :code, :name, :description, :baseUnitId, :controlsInventory)
                """).params(Map.of(
                "id", productId,
                "code", product.code(),
                "name", product.name(),
                "description", product.description(),
                "baseUnitId", baseUnitId,
                "controlsInventory", product.controlsInventory()
        )).update();

        for (NewPresentation item : product.presentations()) {
            UUID presentationId = UUID.randomUUID();
            jdbc.sql("""
                    INSERT INTO product_presentation(id, product_id, code, name, unit_id)
                    VALUES (:id, :productId, :code, :name, :unitId)
                    """).params(Map.of(
                    "id", presentationId,
                    "productId", productId,
                    "code", item.code(),
                    "name", item.name(),
                    "unitId", unitId(item.unitCode())
            )).update();
            jdbc.sql("""
                    INSERT INTO presentation_conversion(id, presentation_id, base_unit_id, conversion_factor)
                    VALUES (:id, :presentationId, :baseUnitId, :factor)
                    """).params(Map.of(
                    "id", UUID.randomUUID(),
                    "presentationId", presentationId,
                    "baseUnitId", baseUnitId,
                    "factor", item.conversionFactor()
            )).update();
        }
        return findById(productId).orElseThrow();
    }

    @Override
    public List<CatalogProduct> findAll() {
        return jdbc.sql("""
                SELECT p.id, p.code, p.name, p.description, u.code AS base_unit_code,
                       p.active, p.controls_inventory
                FROM product p
                JOIN unit_of_measure u ON u.id = p.base_unit_id
                ORDER BY p.name, p.code
                """).query((rs, rowNum) -> productRow(rs)).list().stream().map(this::withPresentations).toList();
    }

    @Override
    public Optional<CatalogProduct> findById(UUID id) {
        return jdbc.sql("""
                SELECT p.id, p.code, p.name, p.description, u.code AS base_unit_code,
                       p.active, p.controls_inventory
                FROM product p
                JOIN unit_of_measure u ON u.id = p.base_unit_id
                WHERE p.id = :id
                """).param("id", id).query((rs, rowNum) -> productRow(rs)).optional().map(this::withPresentations);
    }

    @Override
    public CatalogProduct setActive(UUID id, boolean active) {
        jdbc.sql("UPDATE product SET active = :active, updated_at = now(), version = version + 1 WHERE id = :id")
                .param("active", active).param("id", id).update();
        return findById(id).orElseThrow();
    }

    @Override
    public CatalogProduct updateProduct(UUID id, String name, String description, String baseUnitCode, boolean controlsInventory) {
        int changed = jdbc.sql("""
                UPDATE product SET name=:name,description=:description,base_unit_id=:unitId,
                controls_inventory=:controlsInventory,updated_at=now(),version=version+1 WHERE id=:id
                """).params(Map.of("id", id, "name", name, "description", description,
                "unitId", unitId(baseUnitCode), "controlsInventory", controlsInventory)).update();
        if (changed != 1) throw new BusinessException("PRODUCT_NOT_FOUND", "El producto no existe.", ErrorCategory.NOT_FOUND);
        return findById(id).orElseThrow();
    }

    @Override
    public void deleteProduct(UUID id) {
        try {
            jdbc.sql("DELETE FROM presentation_conversion WHERE presentation_id IN (SELECT id FROM product_presentation WHERE product_id=:id)")
                    .param("id", id).update();
            jdbc.sql("DELETE FROM product_presentation WHERE product_id=:id").param("id", id).update();
            if (jdbc.sql("DELETE FROM product WHERE id=:id").param("id", id).update() != 1) {
                throw new BusinessException("PRODUCT_NOT_FOUND", "El producto no existe.", ErrorCategory.NOT_FOUND);
            }
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException("PRODUCT_DELETE_BLOCKED", "El producto tiene movimientos registrados; desactívelo en lugar de eliminarlo.",
                    ErrorCategory.VALIDATION);
        }
    }

    @Override
    public CatalogProduct updateConversion(UUID productId, UUID presentationId, java.math.BigDecimal factor) {
        int closed = jdbc.sql("""
                UPDATE presentation_conversion pc
                SET valid_to = now()
                WHERE pc.presentation_id = :presentationId
                  AND pc.valid_to IS NULL
                  AND EXISTS (
                      SELECT 1 FROM product_presentation pp
                      WHERE pp.id = pc.presentation_id AND pp.product_id = :productId
                  )
                """).param("presentationId", presentationId).param("productId", productId).update();
        if (closed != 1) {
            throw new IllegalStateException("No existe una conversión vigente para la presentación");
        }
        jdbc.sql("""
                INSERT INTO presentation_conversion(id, presentation_id, base_unit_id, conversion_factor)
                SELECT :id, :presentationId, p.base_unit_id, :factor
                FROM product p
                WHERE p.id = :productId
                """).param("id", UUID.randomUUID()).param("presentationId", presentationId)
                .param("factor", factor).param("productId", productId).update();
        return findById(productId).orElseThrow();
    }

    @Override
    public CatalogProduct setPresentationActive(UUID productId, UUID presentationId, boolean active) {
        int changed = jdbc.sql("""
                UPDATE product_presentation
                SET active = :active, updated_at = now(), version = version + 1
                WHERE id = :presentationId AND product_id = :productId
                """).param("active", active).param("presentationId", presentationId)
                .param("productId", productId).update();
        if (changed != 1) {
            throw new IllegalStateException("No se encontró la presentación del producto");
        }
        return findById(productId).orElseThrow();
    }

    private ProductRow productRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ProductRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("description"), rs.getString("base_unit_code"), rs.getBoolean("active"),
                rs.getBoolean("controls_inventory"));
    }

    private CatalogProduct withPresentations(ProductRow product) {
        var presentations = jdbc.sql("""
                SELECT pp.id, pp.code, pp.name, u.code AS unit_code,
                       pc.conversion_factor, pp.active
                FROM product_presentation pp
                JOIN unit_of_measure u ON u.id = pp.unit_id
                JOIN presentation_conversion pc ON pc.presentation_id = pp.id AND pc.valid_to IS NULL
                WHERE pp.product_id = :productId
                ORDER BY pp.name, pp.code
                """).param("productId", product.id()).query((rs, rowNum) -> new CatalogPresentation(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("unit_code"), rs.getBigDecimal("conversion_factor"), rs.getBoolean("active")
        )).list();
        return new CatalogProduct(product.id(), product.code(), product.name(), product.description(),
                product.baseUnitCode(), product.active(), product.controlsInventory(), presentations);
    }

    private UUID unitId(String code) {
        return jdbc.sql("SELECT id FROM unit_of_measure WHERE code = :code AND active")
                .param("code", code).query(UUID.class).single();
    }

    private CatalogPresentationTemplate templateRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new CatalogPresentationTemplate(rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getString("name"), rs.getString("presentation_type"), rs.getBigDecimal("content_quantity"),
                rs.getString("content_unit"), rs.getString("unit_code"), rs.getBigDecimal("conversion_factor"),
                rs.getBoolean("active"));
    }

    private record ProductRow(UUID id, String code, String name, String description, String baseUnitCode,
                              boolean active, boolean controlsInventory) {
    }
}
