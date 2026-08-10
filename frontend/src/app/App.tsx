import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { LoginPage } from '../features/auth/LoginPage';
import { CompanyConfigurationPage } from '../features/company/CompanyConfigurationPage';
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
