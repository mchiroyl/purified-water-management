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

import java.nio.charset.StandardCharsets;
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

    @GetMapping(value = "/sales.csv", produces = "text/csv")
    public ResponseEntity<byte[]> salesCsv(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return csv("ventas.csv", service.exportCsv(ReportApplicationService.ReportType.SALES,
                parameters.filter(), actor(jwt), sellerOnly(jwt)));
    }

    @GetMapping(value = "/wastes.csv", produces = "text/csv")
    public ResponseEntity<byte[]> wastesCsv(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return csv("mermas.csv", service.exportCsv(ReportApplicationService.ReportType.WASTES,
                parameters.filter(), actor(jwt), sellerOnly(jwt)));
    }

    @GetMapping(value = "/settlements.csv", produces = "text/csv")
    public ResponseEntity<byte[]> settlementsCsv(Parameters parameters, @AuthenticationPrincipal Jwt jwt) {
        return csv("liquidaciones.csv", service.exportCsv(ReportApplicationService.ReportType.SETTLEMENTS,
                parameters.filter(), actor(jwt), sellerOnly(jwt)));
    }

    private ResponseEntity<byte[]> csv(String filename, byte[] body) {
        var type = new MediaType("text", "csv", StandardCharsets.UTF_8);
        return ResponseEntity.ok().contentType(type)
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
