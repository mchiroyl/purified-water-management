import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { LoginPage } from '../features/auth/LoginPage';
import { CompanyConfigurationPage } from '../features/company/CompanyConfigurationPage';
import { ProductCatalogPage } from '../features/catalog/ProductCatalogPage';
import { AdministrationPage } from '../features/administration/AdministrationPage';
import { CustomersPage } from '../features/routes/CustomersPage';
import { RoutesPage } from '../features/routes/RoutesPage';
import { PricingPage } from '../features/pricing/PricingPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { RouteLoadsPage } from '../features/loading/RouteLoadsPage';
import { SalesPage } from '../features/sales/SalesPage';
import { TransfersPage } from '../features/payments/TransfersPage';
import { WastePage } from '../features/waste/WastePage';
import { ReturnsPage } from '../features/returns/ReturnsPage';
import { PendingOperationsPage } from '../offline/PendingOperationsPage';
import { AppShell } from './AppShell';
import { DashboardPage } from './DashboardPage';

export function App() {
  const { user, initializing } = useSession();
  if (initializing) return <main className="auth-page"><section className="auth-card"><p>Restaurando sesión…</p></section></main>;
  if (!user) return <LoginPage />;
  const isAdmin = user.roles.includes('ADMINISTRADOR');
  const canSeeCustomers = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canSeeRoutes = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeePricing = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canSeeInventory = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canManageInventory = user.roles.some(role => ['ADMINISTRADOR', 'BODEGA'].includes(role));
  const canSeeLoads = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeSales = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canVerifyTransfers = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR'].includes(role));
  const canSeeWastes = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeReturns = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const isWarehouse = user.roles.includes('BODEGA');
  const isSeller = user.roles.includes('VENDEDOR');
  const canReviewProvisional = isAdmin || user.roles.includes('SUPERVISOR');
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="company" element={<CompanyConfigurationPage />} />
        <Route path="products" element={<ProductCatalogPage />} />
        <Route path="administration" element={isAdmin ? <AdministrationPage /> : <Navigate to="/" replace />} />
        <Route path="customers" element={canSeeCustomers ? <CustomersPage canManage={isAdmin}
          canCreateRouteCustomer={isAdmin || isSeller} canReviewProvisional={canReviewProvisional}
          deviceId={user.deviceId} /> : <Navigate to="/" replace />} />
        <Route path="routes" element={canSeeRoutes ? <RoutesPage canManage={isAdmin} /> : <Navigate to="/" replace />} />
        <Route path="pricing" element={canSeePricing ? <PricingPage canManage={isAdmin} canApprove={isAdmin || user.roles.includes('SUPERVISOR')} canRequestDiscount={user.roles.includes('VENDEDOR')} /> : <Navigate to="/" replace />} />
        <Route path="inventory" element={canSeeInventory ? <InventoryPage canManage={canManageInventory} /> : <Navigate to="/" replace />} />
        <Route path="loads" element={canSeeLoads ? <RouteLoadsPage canPrepare={isAdmin || isWarehouse} canConfirmWarehouse={isAdmin || isWarehouse} canReceive={isAdmin || isSeller} canStart={isAdmin || isSeller} canCorrect={isAdmin || isWarehouse} /> : <Navigate to="/" replace />} />
        <Route path="sales" element={canSeeSales ? <SalesPage canSell={isAdmin || isSeller} /> : <Navigate to="/" replace />} />
        <Route path="transfers" element={canVerifyTransfers ? <TransfersPage /> : <Navigate to="/" replace />} />
        <Route path="wastes" element={canSeeWastes ? <WastePage canReport canReview={isAdmin || isWarehouse || user.roles.includes('SUPERVISOR')} canManageCatalog={isAdmin} deviceId={user.deviceId} /> : <Navigate to="/" replace />} />
        <Route path="returns" element={canSeeReturns ? <ReturnsPage canReport canReceive={isAdmin || isWarehouse || user.roles.includes('SUPERVISOR')} deviceId={user.deviceId} /> : <Navigate to="/" replace />} />
        <Route path="pending" element={<PendingOperationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
