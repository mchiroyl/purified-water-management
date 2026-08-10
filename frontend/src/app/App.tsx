import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { LoginPage } from '../features/auth/LoginPage';
import { CompanyConfigurationPage } from '../features/company/CompanyConfigurationPage';
import { ProductCatalogPage } from '../features/catalog/ProductCatalogPage';
import { AdministrationPage } from '../features/administration/AdministrationPage';
import { AppShell } from './AppShell';
import { DashboardPage } from './DashboardPage';

export function App() {
  const { user } = useSession();
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="company" element={<CompanyConfigurationPage />} />
        <Route path="products" element={<ProductCatalogPage />} />
        <Route path="administration" element={user.roles.includes('ADMINISTRADOR') ? <AdministrationPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
