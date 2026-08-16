package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.dto.reports.ReportPageResponse;
import gt.com.aguapura.application.dto.reports.SalesReportRow;
import gt.com.aguapura.application.dto.reports.SettlementReportRow;
import gt.com.aguapura.application.dto.reports.WasteReportRow;
import gt.com.aguapura.application.services.ReportApplicationService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@PreAuthorize("hasAnyRole('ADMINISTRADOR','SUPERVISOR','BODEGA','VENDEDOR')")
public class ReportController {
    private final ReportApplicationService service;

    public ReportController(ReportApplicationService service) {
        this.service = service;
    }

    @GetMapping("/sales")
    public ReportPageResponse<SalesReportRow> sales(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return service.sales(parameters.filter(), actor(jwt), sellerOnly(jwt));
    }

    @GetMapping("/wastes")
    public ReportPageResponse<WasteReportRow> wastes(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return service.wastes(parameters.filter(), actor(jwt), sellerOnly(jwt));
    }

    @GetMapping("/settlements")
    public ReportPageResponse<SettlementReportRow> settlements(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return service.settlements(parameters.filter(), actor(jwt), sellerOnly(jwt));
    }

    @GetMapping(value = "/sales.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> salesExcel(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return file("ventas.xlsx", service.exportExcel(ReportApplicationService.ReportType.SALES,
                parameters.filter(), actor(jwt), sellerOnly(jwt)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    @GetMapping(value = "/sales.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> salesPdf(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return file("ventas.pdf", service.exportPdf(ReportApplicationService.ReportType.SALES,
                parameters.filter(), actor(jwt), sellerOnly(jwt)), MediaType.APPLICATION_PDF_VALUE);
    }

    @GetMapping(value = "/wastes.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> wastesExcel(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return file("mermas.xlsx", service.exportExcel(ReportApplicationService.ReportType.WASTES,
                parameters.filter(), actor(jwt), sellerOnly(jwt)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    @GetMapping(value = "/wastes.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> wastesPdf(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return file("mermas.pdf", service.exportPdf(ReportApplicationService.ReportType.WASTES,
                parameters.filter(), actor(jwt), sellerOnly(jwt)), MediaType.APPLICATION_PDF_VALUE);
    }

    @GetMapping(value = "/settlements.xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> settlementsExcel(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return file("liquidaciones.xlsx", service.exportExcel(ReportApplicationService.ReportType.SETTLEMENTS,
                parameters.filter(), actor(jwt), sellerOnly(jwt)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    @GetMapping(value = "/settlements.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> settlementsPdf(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return file("liquidaciones.pdf", service.exportPdf(ReportApplicationService.ReportType.SETTLEMENTS,
                parameters.filter(), actor(jwt), sellerOnly(jwt)), MediaType.APPLICATION_PDF_VALUE);
    }

    private ResponseEntity<byte[]> file(String filename, byte[] body, String mediaType) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(mediaType))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .header("X-Content-Type-Options", "nosniff").body(body);
    }

    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("userId")); }

    private boolean sellerOnly(Jwt jwt) {
        var roles = jwt.getClaimAsStringList("roles");
        return roles.contains("VENDEDOR") && roles.stream().noneMatch(role ->
                role.equals("ADMINISTRADOR") || role.equals("SUPERVISOR") || role.equals("BODEGA"));
    }

    public record Parameters(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "") String seller,
            @RequestParam(defaultValue = "") String route,
            @RequestParam(defaultValue = "") String customer,
            @RequestParam(defaultValue = "") String product,
            @RequestParam(defaultValue = "") String presentation,
            @RequestParam(defaultValue = "") String paymentMethod,
            @RequestParam(defaultValue = "false") Boolean differenceOnly,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "25") Integer size) {
        ReportApplicationService.Filter filter() {
            return new ReportApplicationService.Filter(from, to, seller, route, customer, product,
                    presentation, paymentMethod, Boolean.TRUE.equals(differenceOnly),
                    page == null ? 0 : page, size == null ? 25 : size);
        }
    }
}
