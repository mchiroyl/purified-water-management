import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tag,
  Users,
  MapPin,
  Truck,
  DollarSign,
  Warehouse,
  Inbox,
  ShoppingCart,
  ArrowRightLeft,
  CreditCard,
  Droplets,
  TrendingDown,
  Undo2,
  Receipt,
  CheckSquare,
  XCircle,
  Clock,
  BarChart3,
  ShieldCheck,
  Navigation,
  UserCheck,
  Building2,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useSession } from '../features/auth/SessionContext';
import { ConnectionIndicator } from '../features/connectivity/ConnectionIndicator';
import { apiRequest, resolveApiUrl } from '../services/apiClient';

type NavigationItem = {
  to: string;
  label: string;
  icon: ReactNode;
  visible?: boolean;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export function AppShell() {
  const { user, logout } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState('Inicio');
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const mobileMenuWasOpen = useRef(false);
  const handleLogout = () => {
    setMobileMenuOpen(false);
    navigate('/', { replace: true });
    void logout();
  };
  const isAdmin = user?.roles.includes('ADMINISTRADOR');
  const isCreditAdmin = user?.roles.includes('ADMINISTRADOR_CREDITO');
  const canSeeAudit = isAdmin || user?.roles.includes('SUPERVISOR');
  const canCatalog = user?.roles.some(role => ['ADMINISTRADOR', 'BODEGA', 'SUPERVISOR'].includes(role));
  const canSeeCustomers = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canSeeRoutes = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA'].includes(role));
  const canSeeVehicles = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA'].includes(role));
  const canSeePricing = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR'].includes(role));
  const canSeeInventory = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeLoads = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeSales = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const canVerifyTransfers = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR'].includes(role));
  const canSeeCredit = isAdmin || isCreditAdmin || user?.roles.includes('SUPERVISOR');
  const canSeeJugs = isAdmin || isCreditAdmin || user?.roles.includes('SUPERVISOR');
  const canSeeWastes = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeReturns = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeSettlements = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeOperationsControl = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'BODEGA', 'VENDEDOR'].includes(role));
  const canSeeAnnulments = user?.roles.some(role => ['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR'].includes(role));
  const company = useQuery({
    queryKey: ['company-configuration'],
    queryFn: () => apiRequest<{ commercialName: string; logoUrl?: string; version: number }>('/company-configuration')
  });
  const navigationGroups: NavigationGroup[] = [
    {
      label: 'Inicio',
      items: [{ to: '/', label: 'Panel operativo', icon: <LayoutDashboard size={17} strokeWidth={2} />, visible: true }]
    },
    {
      label: 'Catálogo y planificación',
      items: [
        { to: '/presentations', label: 'Presentaciones', icon: <Package size={17} strokeWidth={2} />, visible: canCatalog },
        { to: '/products', label: 'Productos', icon: <Tag size={17} strokeWidth={2} />, visible: canCatalog },
        { to: '/customers', label: 'Clientes', icon: <Users size={17} strokeWidth={2} />, visible: canSeeCustomers },
        { to: '/routes', label: 'Rutas', icon: <MapPin size={17} strokeWidth={2} />, visible: canSeeRoutes },
        { to: '/vehicles', label: 'Vehículos', icon: <Truck size={17} strokeWidth={2} />, visible: canSeeVehicles },
        { to: '/pricing', label: 'Precios', icon: <DollarSign size={17} strokeWidth={2} />, visible: canSeePricing }
      ]
    },
    {
      label: 'Operación diaria',
      items: [
        { to: '/inventory', label: 'Inventario', icon: <Warehouse size={17} strokeWidth={2} />, visible: canSeeInventory },
        { to: '/loads', label: 'Cargas', icon: <Inbox size={17} strokeWidth={2} />, visible: canSeeLoads },
        { to: '/sales', label: 'Ventas', icon: <ShoppingCart size={17} strokeWidth={2} />, visible: canSeeSales },
        { to: '/transfers', label: 'Transferencias', icon: <ArrowRightLeft size={17} strokeWidth={2} />, visible: canVerifyTransfers },
        { to: '/credit', label: 'Créditos y abonos', icon: <CreditCard size={17} strokeWidth={2} />, visible: canSeeCredit },
        { to: '/jugs', label: 'Control de garrafones', icon: <Droplets size={17} strokeWidth={2} />, visible: canSeeJugs },
        { to: '/wastes', label: 'Mermas', icon: <TrendingDown size={17} strokeWidth={2} />, visible: canSeeWastes },
        { to: '/returns', label: 'Devoluciones', icon: <Undo2 size={17} strokeWidth={2} />, visible: canSeeReturns },
        { to: '/settlements', label: 'Liquidaciones', icon: <Receipt size={17} strokeWidth={2} />, visible: canSeeSettlements }
      ]
    },
    {
      label: 'Control y seguimiento',
      items: [
        { to: '/operations-control', label: 'Cierre de operaciones', icon: <CheckSquare size={17} strokeWidth={2} />, visible: canSeeOperationsControl },
        { to: '/annulments', label: 'Anulaciones', icon: <XCircle size={17} strokeWidth={2} />, visible: canSeeAnnulments },
        { to: '/pending', label: 'Pendientes', icon: <Clock size={17} strokeWidth={2} />, visible: true },
        { to: '/reports', label: 'Reportes', icon: <BarChart3 size={17} strokeWidth={2} />, visible: true },
        { to: '/audit', label: 'Auditoría', icon: <ShieldCheck size={17} strokeWidth={2} />, visible: canSeeAudit },
        { to: '/route-history', label: 'Historial de rutas', icon: <Navigation size={17} strokeWidth={2} />, visible: isAdmin || user?.roles.includes('SUPERVISOR') }
      ]
    },
    {
      label: 'Administración',
      items: [
        { to: '/administration', label: 'Usuarios', icon: <UserCheck size={17} strokeWidth={2} />, visible: isAdmin },
        { to: '/company', label: 'Datos de la empresa', icon: <Building2 size={17} strokeWidth={2} />, visible: isAdmin }
      ]
    }
  ];
  const visibleNavigationGroups = navigationGroups
    .map(group => ({ ...group, items: group.items.filter(item => item.visible) }))
    .filter(group => group.items.length > 0);
  useEffect(() => {
    const activeGroup = navigationGroups.find(group => group.items.some(item => item.to === location.pathname || (item.to !== '/' && location.pathname.startsWith(`${item.to}/`))));
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
        }}>
          <span className="nav-icon" aria-hidden="true" style={{ marginRight: '8px', display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>
          {item.label}
        </NavLink>)}
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
          {company.data?.logoUrl && <img src={`${resolveApiUrl(company.data.logoUrl)}?v=${company.data.version}`} alt="" />}
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
