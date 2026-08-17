# Page dependency summaries

All pages import the shared CSS from `frontend/src/main.tsx`; authenticated pages render inside `AppShell`.

## Dashboard `/`
- `frontend/src/app/DashboardPage.tsx`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Catalog `/products`
- `frontend/src/features/catalog/ProductCatalogPage.tsx`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Customers `/customers`
- `frontend/src/features/routes/CustomersPage.tsx`
  - `frontend/src/features/routes/provisionalCustomerOffline.ts`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Routes `/routes`
- `frontend/src/features/routes/RoutesPage.tsx`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Sales `/sales`
- `frontend/src/features/sales/SalesPage.tsx`
  - `frontend/src/features/sales/receiptOffline.ts`
  - `frontend/src/features/sales/receiptSharing.ts`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Loads `/loads`
- `frontend/src/features/loading/RouteLoadsPage.tsx`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Reports `/reports`
- `frontend/src/features/reports/ReportsPage.tsx`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Administration `/administration`
- `frontend/src/features/administration/AdministrationPage.tsx`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Company `/company`
- `frontend/src/features/company/CompanyConfigurationPage.tsx`
  - `frontend/src/services/apiClient.ts`
  - `frontend/src/styles.css`

## Authentication
- `frontend/src/features/auth/LoginPage.tsx`
- `frontend/src/features/auth/PasswordChangePage.tsx`
- `frontend/src/features/auth/SessionContext.tsx`
- `frontend/src/styles.css`
