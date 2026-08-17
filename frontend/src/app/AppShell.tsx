import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { ConnectionIndicator } from '../features/connectivity/ConnectionIndicator';
import { apiRequest } from '../services/apiClient';

export function AppShell() {
  const { user, logout } = useSession();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState('Inicio');
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const mobileMenuWasOpen = useRef(false);
  const handleLogout = () => {
    setMobileMenuOpen(false);
    void logout();
  };
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
  const navigationGroups = [
    {
      label: 'Inicio',
      items: [{ to: '/', label: 'Panel operativo', visible: true }]
    },
    {
      label: 'Catálogo y planificación',
      items: [
        { to: '/presentations', label: 'Presentaciones', visible: canCatalog },
        { to: '/products', label: 'Productos', visible: canCatalog },
        { to: '/customers', label: 'Clientes', visible: canSeeCustomers },
        { to: '/routes', label: 'Rutas', visible: canSeeRoutes },
        { to: '/vehicles', label: 'Vehículos', visible: canSeeRoutes },
        { to: '/pricing', label: 'Precios', visible: canSeePricing }
      ]
    },
    {
      label: 'Operación diaria',
      items: [
        { to: '/inventory', label: 'Inventario', visible: canSeeInventory },
        { to: '/loads', label: 'Cargas', visible: canSeeLoads },
        { to: '/sales', label: 'Ventas', visible: canSeeSales },
        { to: '/transfers', label: 'Transferencias', visible: canVerifyTransfers },
        { to: '/wastes', label: 'Mermas', visible: canSeeWastes },
        { to: '/returns', label: 'Devoluciones', visible: canSeeReturns },
        { to: '/settlements', label: 'Liquidaciones', visible: canSeeSettlements }
      ]
    },
    {
      label: 'Control y seguimiento',
      items: [
        { to: '/operations-control', label: 'Control operativo', visible: canSeeOperationsControl },
        { to: '/annulments', label: 'Anulaciones', visible: canSeeAnnulments },
        { to: '/pending', label: 'Pendientes', visible: true },
        { to: '/reports', label: 'Reportes', visible: true },
        { to: '/audit', label: 'Auditoría', visible: canSeeAudit }
      ]
    },
    {
      label: 'Administración',
      items: [
        { to: '/administration', label: 'Usuarios', visible: isAdmin },
        { to: '/company', label: 'Datos de la empresa', visible: isAdmin },
        { to: '/fel-configuration', label: 'FEL opcional', visible: isAdmin }
      ]
    }
  ];
  const visibleNavigationGroups = navigationGroups
    .map(group => ({ ...group, items: group.items.filter(item => item.visible) }))
    .filter(group => group.items.length > 0);
  useEffect(() => {
    const activeGroup = navigationGroups.find(group => group.items.some(item => item.to === location.pathname));
    if (activeGroup) setExpandedGroup(activeGroup.label);
  }, [location.pathname]);

  const renderNavigation = (scope: 'desktop' | 'mobile', onNavigate?: () => void) => visibleNavigationGroups.map((group, index) => {
    const expanded = expandedGroup === group.label;
    const panelId = `${scope}-navigation-group-${index}`;
    return (
    <section className="nav-group" key={group.label}>
      <button className="nav-group-trigger" type="button" aria-expanded={expanded} aria-controls={panelId}
        onClick={() => setExpandedGroup(current => current === group.label ? '' : group.label)}>
        {group.label}
      </button>
      {expanded && <div id={panelId} className="nav-group-links">
        {group.items.map(item => <NavLink key={item.to} to={item.to} onClick={() => {
          setExpandedGroup(group.label);
          onNavigate?.();
        }}>{item.label}</NavLink>)}
      </div>}
    </section>
  );
  });

  useEffect(() => {
    if (mobileMenuOpen) {
      mobileMenuCloseRef.current?.focus();
      const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setMobileMenuOpen(false);
      };
      document.addEventListener('keydown', closeOnEscape);
      mobileMenuWasOpen.current = true;
      return () => document.removeEventListener('keydown', closeOnEscape);
    }
    if (mobileMenuWasOpen.current) mobileMenuTriggerRef.current?.focus();
    mobileMenuWasOpen.current = false;
  }, [mobileMenuOpen]);

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
        <nav aria-label="Principal">{renderNavigation('desktop')}</nav>
        <button className="secondary" onClick={handleLogout}>Cerrar sesión</button>
      </aside>
      <section className="page"><Outlet /></section>
      <nav className="bottom-nav" aria-label="Navegación móvil">
        <button
          ref={mobileMenuTriggerRef}
          className="mobile-menu-trigger"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu-panel"
          onClick={() => setMobileMenuOpen(open => !open)}
        >
          Menú
        </button>
      </nav>
      {mobileMenuOpen && <div className="mobile-menu-overlay" onMouseDown={event => {
        if (event.target === event.currentTarget) setMobileMenuOpen(false);
      }}>
        <section id="mobile-menu-panel" className="mobile-menu-panel" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title">
          <div className="mobile-menu-header">
            <h2 id="mobile-menu-title">Menú principal</h2>
            <button ref={mobileMenuCloseRef} className="secondary" type="button" onClick={() => setMobileMenuOpen(false)}>Cerrar menú</button>
          </div>
          <nav className="mobile-menu-list" aria-label="Todas las opciones">
            {renderNavigation('mobile', () => setMobileMenuOpen(false))}
          </nav>
          <div className="mobile-menu-footer">
            <button className="secondary" type="button" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
