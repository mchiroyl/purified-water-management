import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { ConnectionIndicator } from '../features/connectivity/ConnectionIndicator';

export function AppShell() {
  const { user, logout } = useSession();
  return (
    <div className="app-shell">
      <header>
        <div><strong>Agua Pura</strong><span className="user-name">{user?.displayName}</span></div>
        <ConnectionIndicator />
      </header>
      <aside>
        <nav aria-label="Principal">
          <NavLink to="/">Inicio</NavLink>
          <NavLink to="/products">Productos</NavLink>
          <NavLink to="/company">Configuración</NavLink>
        </nav>
        <button className="secondary" onClick={() => void logout()}>Cerrar sesión</button>
      </aside>
      <section className="page"><Outlet /></section>
      <nav className="bottom-nav" aria-label="Navegación móvil">
        <NavLink to="/">Inicio</NavLink>
        <NavLink to="/products">Productos</NavLink>
        <NavLink to="/company">Configuración</NavLink>
      </nav>
    </div>
  );
}
