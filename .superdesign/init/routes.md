# Route map

The router is declared in `frontend/src/app/App.tsx` and all authenticated pages use `AppShell`.

| URL | Component | Access notes |
|---|---|---|
| `/` | `DashboardPage` | authenticated |
| `/products` | `ProductCatalogPage` | catalog roles |
| `/customers` | `CustomersPage` | admin/supervisor/seller |
| `/routes` | `RoutesPage` | admin/supervisor/warehouse/seller |
| `/pricing` | `PricingPage` | admin/supervisor/seller |
| `/inventory` | `InventoryPage` | admin/supervisor/warehouse/seller |
| `/loads` | `RouteLoadsPage` | admin/supervisor/warehouse/seller |
| `/sales` | `SalesPage` | admin/supervisor/seller |
| `/transfers` | `TransfersPage` | admin/supervisor |
| `/wastes` | `WastePage` | admin/supervisor/warehouse/seller |
| `/returns` | `ReturnsPage` | admin/supervisor/warehouse/seller |
| `/settlements` | `SettlementPage` | admin/supervisor/warehouse/seller |
| `/operations-control` | `OperationsControlPage` | admin/supervisor/warehouse/seller |
| `/annulments` | `AnnulmentsPage` | admin/supervisor/seller |
| `/pending` | `PendingOperationsPage` | authenticated |
| `/reports` | `ReportsPage` | authenticated |
| `/audit` | `AuditPage` | admin/supervisor |
| `/administration` | `AdministrationPage` | admin |
| `/company` | `CompanyConfigurationPage` | admin |
| `/fel-configuration` | `FelConfigurationPage` | admin |

`/login` is rendered by `App` when there is no session and `/password-change` is rendered when the session requires a password change.
