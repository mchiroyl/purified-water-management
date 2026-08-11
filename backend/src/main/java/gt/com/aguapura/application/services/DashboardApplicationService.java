package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.dashboard.DashboardResponse;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.application.ports.DashboardPort;
import gt.com.aguapura.domain.dashboard.DashboardDateRange;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Clock;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.UUID;

@Service
public class DashboardApplicationService {
    private final DashboardPort dashboard;
    private final CompanyConfigurationPersistencePort company;
    private final Clock clock;

    @Autowired
    public DashboardApplicationService(DashboardPort dashboard, CompanyConfigurationPersistencePort company) {
        this(dashboard, company, Clock.systemUTC());
    }

    DashboardApplicationService(DashboardPort dashboard, CompanyConfigurationPersistencePort company, Clock clock) {
        this.dashboard = dashboard;
        this.company = company;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DashboardResponse get(UUID actorId, boolean restrictedToSeller) {
        var configuration = company.find().orElseThrow(() -> new BusinessException(
                "COMPANY_CONFIGURATION_NOT_FOUND", "Configure los datos de la empresa.", ErrorCategory.NOT_FOUND));
        var generatedAt = clock.instant();
        var timezone = ZoneId.of(configuration.timezone());
        var range = DashboardDateRange.today(generatedAt, timezone);
        var metrics = dashboard.load(range.startInclusive(), range.endExclusive(),
                generatedAt.atZone(timezone).toLocalDate(), actorId, restrictedToSeller);
        var alerts = new ArrayList<DashboardResponse.DashboardAlertResponse>();
        addAlert(alerts, "CASH_SHORTAGE", "CRITICAL", "Faltante de efectivo",
                metrics.monetaryDifferences().signum() == 0 ? 0 : 1);
        addAlert(alerts, "INVENTORY_SHORTAGE", "CRITICAL", "Diferencia de inventario",
                metrics.inventoryDifferences().signum() == 0 ? 0 : 1);
        addAlert(alerts, "WASTE_PENDING", "WARNING", "Mermas pendientes", metrics.pendingWastes());
        addAlert(alerts, "TRANSFER_PENDING", "WARNING", "Transferencias pendientes", metrics.pendingTransfers());
        addAlert(alerts, "SYNC_PENDING", "WARNING", "Operaciones offline pendientes", metrics.pendingOfflineOperations());
        addAlert(alerts, "ROUTE_OPEN", "WARNING", "Rutas sin cerrar", metrics.activeRoutes());
        addAlert(alerts, "INCIDENT_OPEN", "CRITICAL", "Incidencias abiertas", metrics.openIncidents());
        return new DashboardResponse(generatedAt, configuration.timezone(), configuration.currencyCode(),
                metrics.salesToday(), metrics.expectedCash(), metrics.deliveredCash(), metrics.transfers(),
                metrics.credit(), metrics.monetaryDifferences(), metrics.inventoryDifferences(),
                metrics.approvedWasteUnits(), metrics.pendingWastes(), metrics.provisionalCustomers(),
                metrics.pendingTransfers(), metrics.activeRoutes(), metrics.completedRoutes(),
                metrics.pendingOfflineOperations(), metrics.pendingReturns(), metrics.pendingAuthorizations(),
                metrics.openIncidents(), alerts);
    }

    private void addAlert(ArrayList<DashboardResponse.DashboardAlertResponse> alerts, String code,
                          String severity, String title, long count) {
        if (count > 0) alerts.add(new DashboardResponse.DashboardAlertResponse(code, severity, title, count));
    }
}
