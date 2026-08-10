import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { LoginPage } from '../features/auth/LoginPage';
import { CompanyConfigurationPage } from '../features/company/CompanyConfigurationPage';
import { ProductCatalogPage } from '../features/catalog/ProductCatalogPage';
import { AdministrationPage } from '../features/administration/AdministrationPage';
import { CustomersPage } from '../features/routes/CustomersPage';
import { RoutesPage } from '../features/routes/RoutesPage';
import { AppShell } from './AppShell';
import { DashboardPage } from './DashboardPage';

export function App() {
  const { user, initializing } = useSession();
  if (initializing) return <main className="auth-page"><section className="auth-card"><p>Restaurando sesión…</p></section></main>;
  if (!user) return <LoginPage />;
  const isAdmin = user.roles.includes('ADMINISTRADOR');
  const canSeeCustomers = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canSeeRoutes = user.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="company" element={<CompanyConfigurationPage />} />
        <Route path="products" element={<ProductCatalogPage />} />
        <Route path="administration" element={isAdmin ? <AdministrationPage /> : <Navigate to="/" replace />} />
        <Route path="customers" element={canSeeCustomers ? <CustomersPage canManage={isAdmin} /> : <Navigate to="/" replace />} />
        <Route path="routes" element={canSeeRoutes ? <RoutesPage canManage={isAdmin} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
