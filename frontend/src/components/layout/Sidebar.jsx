import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const roleLabel = { admin: 'Administrador', atendente: 'Atendente', cozinha: 'Cozinha' };

const navItems = [
  { to: '/',        icon: '📊', label: 'Dashboard',  roles: ['admin', 'atendente'] },
  { to: '/tables',  icon: '🪑', label: 'Mesas',       roles: ['admin', 'atendente'] },
  { to: '/orders',  icon: '📋', label: 'Pedidos',     roles: ['admin', 'atendente'] },
  { to: '/kitchen', icon: '👨‍🍳', label: 'Cozinha',    roles: ['admin', 'cozinha'] },
  { to: '/menu',    icon: '🍽️', label: 'Cardápio',   roles: ['admin'] },
  { to: '/history', icon: '📁', label: 'Histórico',   roles: ['admin', 'atendente'] },
  { to: '/users',   icon: '👥', label: 'Usuários',    roles: ['admin'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>🍽️ Pandora</h1>
        <p>Gestão de Pedidos</p>
      </div>

      <nav className="sidebar-nav" role="navigation" aria-label="Menu principal">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            aria-label={item.label}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar" aria-hidden="true">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info min-w-0">
            <div className="sidebar-user-name truncate">{user?.name}</div>
            <div className="sidebar-user-role">{roleLabel[user?.role]}</div>
          </div>
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Sair do sistema"
            aria-label="Sair do sistema"
            id="btn-logout"
          >
            ↩
          </button>
        </div>
      </div>
    </aside>
  );
}
