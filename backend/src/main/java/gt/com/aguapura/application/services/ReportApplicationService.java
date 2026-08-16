package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.reports.ReportPageResponse;
import gt.com.aguapura.application.dto.reports.SalesReportRow;
import gt.com.aguapura.application.dto.reports.SettlementReportRow;
import gt.com.aguapura.application.dto.reports.WasteReportRow;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.application.ports.ReportPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.reports.ReportDateRange;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.Arrays;

@Service
public class ReportApplicationService {
    private static final int EXPORT_LIMIT = 20_000;
    private static final Set<String> PAYMENT_METHODS = Set.of("", "CASH", "TRANSFER", "CREDIT");
    private final ReportPort reports;
    private final CompanyConfigurationPersistencePort company;
    private final gt.com.aguapura.application.ports.ReportDocumentPort documents;

    public ReportApplicationService(ReportPort reports, CompanyConfigurationPersistencePort company,
                                    gt.com.aguapura.application.ports.ReportDocumentPort documents) {
        this.reports = reports;
        this.company = company;
        this.documents = documents;
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
    public byte[] exportExcel(ReportType type, Filter filter, UUID actor, boolean restricted) {
        return export(type, filter, actor, restricted, false);
    }

    @Transactional(readOnly = true)
    public byte[] exportPdf(ReportType type, Filter filter, UUID actor, boolean restricted) {
        return export(type, filter, actor, restricted, true);
    }

    private byte[] export(ReportType type, Filter filter, UUID actor, boolean restricted, boolean pdf) {
        var exportFilter = new Filter(filter.from(), filter.to(), filter.seller(), filter.route(), filter.customer(),
                filter.product(), filter.presentation(), filter.paymentMethod(), filter.differenceOnly(), 0, EXPORT_LIMIT);
        var configuration = company.find().orElseThrow(() -> validation(
                "COMPANY_CONFIGURATION_NOT_FOUND", "Configure los datos de la empresa."));
        var page = switch (type) {
            case SALES -> reports.sales(query(exportFilter, true), actor, restricted);
            case WASTES -> reports.wastes(query(exportFilter, true), actor, restricted);
            case SETTLEMENTS -> reports.settlements(query(exportFilter, true), actor, restricted);
        };
        ensureComplete(page);
        var content = documentData(type, page);
        return pdf ? documents.pdf(content.title(), configuration, filterSummary(filter), content.headers(), content.rows())
                : documents.excel(content.title(), configuration, filterSummary(filter), content.headers(), content.rows());
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

    private void ensureComplete(ReportPageResponse<?> page) {
        if (page.totalElements() > EXPORT_LIMIT) {
            throw validation("REPORT_EXPORT_LIMIT", "El reporte supera 20,000 filas; reduzca el rango o los filtros.");
        }
    }

    private DocumentData documentData(ReportType type, ReportPageResponse<?> page) {
        return switch (type) {
            case SALES -> new DocumentData("Ventas", List.of("Documento", "Fecha", "Vendedor", "Ruta", "Cliente", "Producto", "Presentación", "Cantidad", "Unidades base", "Precio unitario", "Total línea", "Total venta", "Pagos", "Efectivo", "Transferencia", "Crédito", "Estado"),
                    ((ReportPageResponse<SalesReportRow>) page).content().stream().map(row -> values(row.documentNumber(), row.occurredAt(), row.sellerName(), row.routeName(), row.customerName(), row.productName(), row.presentationName(), row.presentationQuantity(), row.baseUnits(), row.unitPrice(), row.lineTotal(), row.saleTotal(), row.paymentMethods(), row.cashAmount(), row.transferAmount(), row.creditAmount(), row.saleStatus())).toList());
            case WASTES -> new DocumentData("Mermas", List.of("Fecha", "Vendedor", "Ruta", "Producto", "Presentación", "Tipo", "Reportado", "Aprobado", "Estado", "Motivo"),
                    ((ReportPageResponse<WasteReportRow>) page).content().stream().map(row -> values(row.occurredAt(), row.sellerName(), row.routeName(), row.productName(), row.presentationName(), row.wasteType(), row.reportedUnits(), row.approvedUnits(), row.status(), row.reason())).toList());
            case SETTLEMENTS -> new DocumentData("Liquidaciones", List.of("Fecha", "Vendedor", "Ruta", "Carga", "Ventas", "Efectivo esperado", "Efectivo entregado", "Transferencias", "Crédito", "Diferencia monetaria", "Diferencia inventario", "Estado"),
                    ((ReportPageResponse<SettlementReportRow>) page).content().stream().map(row -> values(row.occurredAt(), row.sellerName(), row.routeName(), row.loadNumber(), row.salesTotal(), row.expectedCash(), row.deliveredCash(), row.transfers(), row.credit(), row.monetaryDifference(), row.inventoryDifference(), row.status())).toList());
        };
    }

    private String filterSummary(Filter filter) {
        return String.join(" | ", List.of(
                "Desde=" + value(filter.from()), "Hasta=" + value(filter.to()), "Vendedor=" + value(filter.seller()),
                "Ruta=" + value(filter.route()), "Cliente=" + value(filter.customer()), "Producto=" + value(filter.product()),
                "Presentación=" + value(filter.presentation()), "Pago=" + value(filter.paymentMethod()),
                "Solo diferencias=" + filter.differenceOnly()));
    }

    private static String value(Object value) { return value == null ? "" : value.toString(); }
    private static List<String> values(Object... values) { return Arrays.stream(values).map(ReportApplicationService::value).toList(); }

    private record DocumentData(String title, List<String> headers, List<List<String>> rows) {}

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    public enum ReportType { SALES, WASTES, SETTLEMENTS }

    public record Filter(LocalDate from, LocalDate to, String seller, String route, String customer,
                         String product, String presentation, String paymentMethod,
                         boolean differenceOnly, int page, int size) {
    }
}
