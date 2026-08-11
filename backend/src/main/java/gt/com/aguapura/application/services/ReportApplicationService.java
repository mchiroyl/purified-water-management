package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.reports.ReportPageResponse;
import gt.com.aguapura.application.dto.reports.SalesReportRow;
import gt.com.aguapura.application.dto.reports.SettlementReportRow;
import gt.com.aguapura.application.dto.reports.WasteReportRow;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.application.ports.ReportPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.reports.CsvCellEncoder;
import gt.com.aguapura.domain.reports.ReportDateRange;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ReportApplicationService {
    private static final int EXPORT_LIMIT = 20_000;
    private static final Set<String> PAYMENT_METHODS = Set.of("", "CASH", "TRANSFER", "CREDIT");
    private final ReportPort reports;
    private final CompanyConfigurationPersistencePort company;

    public ReportApplicationService(ReportPort reports, CompanyConfigurationPersistencePort company) {
        this.reports = reports;
        this.company = company;
    }

    @Transactional(readOnly = true)
    public ReportPageResponse<SalesReportRow> sales(Filter filter, UUID actor, boolean restricted) {
        return reports.sales(query(filter, false), actor, restricted);
    }

    @Transactional(readOnly = true)
    public ReportPageResponse<WasteReportRow> wastes(Filter filter, UUID actor, boolean restricted) {
        return reports.wastes(query(filter, false), actor, restricted);
    }

    @Transactional(readOnly = true)
    public ReportPageResponse<SettlementReportRow> settlements(Filter filter, UUID actor, boolean restricted) {
        return reports.settlements(query(filter, false), actor, restricted);
    }

    @Transactional(readOnly = true)
    public byte[] exportCsv(ReportType type, Filter filter, UUID actor, boolean restricted) {
        var exportFilter = new Filter(filter.from(), filter.to(), filter.seller(), filter.route(), filter.customer(),
                filter.product(), filter.presentation(), filter.paymentMethod(), filter.differenceOnly(), 0, EXPORT_LIMIT);
        var csv = switch (type) {
            case SALES -> salesCsv(reports.sales(query(exportFilter, true), actor, restricted));
            case WASTES -> wastesCsv(reports.wastes(query(exportFilter, true), actor, restricted));
            case SETTLEMENTS -> settlementsCsv(reports.settlements(query(exportFilter, true), actor, restricted));
        };
        byte[] content = csv.getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[content.length + 3];
        withBom[0] = (byte) 0xEF; withBom[1] = (byte) 0xBB; withBom[2] = (byte) 0xBF;
        System.arraycopy(content, 0, withBom, 3, content.length);
        return withBom;
    }

    private ReportPort.Query query(Filter filter, boolean export) {
        if (!export && (filter.page() < 0 || filter.size() < 1 || filter.size() > 100)) {
            throw validation("INVALID_REPORT_PAGE", "La página o el tamaño solicitado no es válido.");
        }
        String payment = clean(filter.paymentMethod()).toUpperCase(Locale.ROOT);
        if (!PAYMENT_METHODS.contains(payment)) {
            throw validation("INVALID_PAYMENT_FILTER", "La forma de pago del filtro no es válida.");
        }
        var configuration = company.find().orElseThrow(() -> validation(
                "COMPANY_CONFIGURATION_NOT_FOUND", "Configure los datos de la empresa."));
        var range = ReportDateRange.of(filter.from(), filter.to(), ZoneId.of(configuration.timezone()), Clock.systemUTC());
        return new ReportPort.Query(range.startInclusive(), range.endExclusive(), clean(filter.seller()),
                clean(filter.route()), clean(filter.customer()), clean(filter.product()),
                clean(filter.presentation()), payment, filter.differenceOnly(), filter.page(), filter.size());
    }

    private String clean(String value) {
        if (value == null) return "";
        String cleaned = value.trim();
        if (cleaned.length() > 100) throw validation("REPORT_FILTER_TOO_LONG", "Un filtro supera 100 caracteres.");
        return cleaned;
    }

    private String salesCsv(ReportPageResponse<SalesReportRow> page) {
        ensureComplete(page);
        var lines = new StringBuilder("Documento,Fecha,Vendedor,Ruta,Cliente,Producto,Presentación,Cantidad,Unidades base,Precio unitario,Total línea,Total venta,Pagos,Efectivo,Transferencia,Crédito,Estado\r\n");
        page.content().forEach(row -> line(lines, row.documentNumber(), row.occurredAt(), row.sellerName(), row.routeName(),
                row.customerName(), row.productName(), row.presentationName(), row.presentationQuantity(), row.baseUnits(),
                row.unitPrice(), row.lineTotal(), row.saleTotal(), row.paymentMethods(), row.cashAmount(),
                row.transferAmount(), row.creditAmount(), row.saleStatus()));
        return lines.toString();
    }

    private String wastesCsv(ReportPageResponse<WasteReportRow> page) {
        ensureComplete(page);
        var lines = new StringBuilder("Fecha,Vendedor,Ruta,Producto,Presentación,Tipo,Reportado,Aprobado,Estado,Motivo\r\n");
        page.content().forEach(row -> line(lines, row.occurredAt(), row.sellerName(), row.routeName(), row.productName(),
                row.presentationName(), row.wasteType(), row.reportedUnits(), row.approvedUnits(), row.status(), row.reason()));
        return lines.toString();
    }

    private String settlementsCsv(ReportPageResponse<SettlementReportRow> page) {
        ensureComplete(page);
        var lines = new StringBuilder("Fecha,Vendedor,Ruta,Carga,Ventas,Efectivo esperado,Efectivo entregado,Transferencias,Crédito,Diferencia monetaria,Diferencia inventario,Estado\r\n");
        page.content().forEach(row -> line(lines, row.occurredAt(), row.sellerName(), row.routeName(), row.loadNumber(),
                row.salesTotal(), row.expectedCash(), row.deliveredCash(), row.transfers(), row.credit(),
                row.monetaryDifference(), row.inventoryDifference(), row.status()));
        return lines.toString();
    }

    private void ensureComplete(ReportPageResponse<?> page) {
        if (page.totalElements() > EXPORT_LIMIT) {
            throw validation("REPORT_EXPORT_LIMIT", "El reporte supera 20,000 filas; reduzca el rango o los filtros.");
        }
    }

    private void line(StringBuilder target, Object... values) {
        target.append(String.join(",", List.of(values).stream().map(CsvCellEncoder::encode).toList())).append("\r\n");
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    public enum ReportType { SALES, WASTES, SETTLEMENTS }

    public record Filter(LocalDate from, LocalDate to, String seller, String route, String customer,
                         String product, String presentation, String paymentMethod,
                         boolean differenceOnly, int page, int size) {
    }
}
