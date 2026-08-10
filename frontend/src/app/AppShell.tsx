import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { ConnectionIndicator } from '../features/connectivity/ConnectionIndicator';
import { apiRequest } from '../services/apiClient';

export function AppShell() {
  const { user, logout } = useSession();
  const isAdmin = user?.roles.includes('ADMINISTRADOR');
  const canCatalog = user?.roles.some(role => ['ADMINISTRADOR', 'BODEGA', 'SUPERVISOR'].includes(role));
  const company = useQuery({
    queryKey: ['company-configuration'],
    queryFn: () => apiRequest<{ commercialName: string; logoUrl?: string; version: number }>('/company-configuration')
  });
  const navigation = <>
    <NavLink to="/">Inicio</NavLink>
    {canCatalog && <NavLink to="/products">Productos</NavLink>}
    {isAdmin && <NavLink to="/administration">Usuarios</NavLink>}
    {isAdmin && <NavLink to="/company">Configuración</NavLink>}
  </>;

  return (
    <div className="app-shell">
      <header>
        <div className="header-brand">
          {company.data?.logoUrl && <img src={`${company.data.logoUrl}?v=${company.data.version}`} alt="" />}
          <div><strong>{company.data?.commercialName ?? 'Agua Pura'}</strong><span className="user-name">{user?.displayName}</span></div>
        </div>
        <ConnectionIndicator />
      </header>
      <aside>
        <nav aria-label="Principal">{navigation}</nav>
        <button className="secondary" onClick={() => void logout()}>Cerrar sesión</button>
      </aside>
      <section className="page"><Outlet /></section>
      <nav className="bottom-nav" aria-label="Navegación móvil">{navigation}</nav>
    </div>
  );
}
