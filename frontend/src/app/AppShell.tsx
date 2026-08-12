import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { ConnectionIndicator } from '../features/connectivity/ConnectionIndicator';
import { apiRequest } from '../services/apiClient';

export function AppShell() {
  const { user, logout } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = user?.roles.includes('ADMINISTRADOR');
  const canSeeAudit = isAdmin || user?.roles.includes('SUPERVISOR');
  const canCatalog = user?.roles.some(role => ['ADMINISTRADOR', 'BODEGA', 'SUPERVISOR'].includes(role));
  const canSeeCustomers = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canSeeRoutes = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeePricing = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canSeeInventory = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeLoads = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeSales = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canVerifyTransfers = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR'].includes(role));
  const canSeeWastes = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeReturns = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeSettlements = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeOperationsControl = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeAnnulments = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const company = useQuery({
    queryKey: ['company-configuration'],
    queryFn: () => apiRequest<{ commercialName: string; logoUrl?: string; version: number }>('/company-configuration')
  });
  const navigationItems = [
    { to: '/', label: 'Inicio', visible: true },
    { to: '/products', label: 'Productos', visible: canCatalog },
    { to: '/customers', label: 'Clientes', visible: canSeeCustomers },
    { to: '/routes', label: 'Rutas', visible: canSeeRoutes },
    { to: '/pricing', label: 'Precios', visible: canSeePricing },
    { to: '/inventory', label: 'Inventario', visible: canSeeInventory },
    { to: '/loads', label: 'Cargas', visible: canSeeLoads },
    { to: '/sales', label: 'Ventas', visible: canSeeSales },
    { to: '/transfers', label: 'Transferencias', visible: canVerifyTransfers },
    { to: '/wastes', label: 'Mermas', visible: canSeeWastes },
    { to: '/returns', label: 'Devoluciones', visible: canSeeReturns },
    { to: '/settlements', label: 'Liquidaciones', visible: canSeeSettlements },
    { to: '/operations-control', label: 'Control operativo', visible: canSeeOperationsControl },
    { to: '/annulments', label: 'Anulaciones', visible: canSeeAnnulments },
    { to: '/pending', label: 'Pendientes', visible: true },
    { to: '/reports', label: 'Reportes', visible: true },
    { to: '/audit', label: 'Auditoría', visible: canSeeAudit },
    { to: '/administration', label: 'Usuarios', visible: isAdmin },
    { to: '/company', label: 'Datos de la empresa', visible: isAdmin },
    { to: '/fel-configuration', label: 'FEL opcional', visible: isAdmin },
  ];
  const renderNavigation = (onNavigate?: () => void) => navigationItems
    .filter(item => item.visible)
    .map(item => <NavLink key={item.to} to={item.to} onClick={onNavigate}>{item.label}</NavLink>);

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
        <nav aria-label="Principal">{renderNavigation()}</nav>
        <button className="secondary" onClick={() => void logout()}>Cerrar sesión</button>
      </aside>
      <section className="page"><Outlet /></section>
      <nav className="bottom-nav" aria-label="Navegación móvil">
        <button
          className="mobile-menu-trigger"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu-panel"
          onClick={() => setMobileMenuOpen(open => !open)}
        >
          Menú
        </button>
      </nav>
      {mobileMenuOpen && <div className="mobile-menu-overlay">
        <section id="mobile-menu-panel" className="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Menú principal">
          <div className="mobile-menu-header">
            <h2>Menú</h2>
            <button className="secondary" type="button" onClick={() => setMobileMenuOpen(false)}>Cerrar menú</button>
          </div>
          <nav className="mobile-menu-list" aria-label="Todas las opciones">
            {renderNavigation(() => setMobileMenuOpen(false))}
          </nav>
        </section>
      </div>}
    </div>
  );
}
