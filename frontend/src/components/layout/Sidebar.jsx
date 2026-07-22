import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const roleLabel = { admin: 'Administrador', atendente: 'Atendente', cozinha: 'Cozinha' };

const navItems = [
  { to: '/',          icon: '📊', label: 'Dashboard',  roles: ['admin', 'atendente'] },
  { to: '/tables',    icon: '🪑', label: 'Mesas',       roles: ['admin', 'atendente'] },
  { to: '/orders',    icon: '📋', label: 'Pedidos',     roles: ['admin', 'atendente'] },
  { to: '/kitchen',   icon: '👨‍🍳', label: 'Cozinha',    roles: ['admin', 'cozinha'] },
  { to: '/menu',      icon: '🍽️', label: 'Cardápio',   roles: ['admin'] },
  { to: '/history',   icon: '📁', label: 'Histórico',   roles: ['admin', 'atendente'] },
  { to: '/finance',   icon: '💰', label: 'Financeiro',  roles: ['admin'] },
  { to: '/analytics', icon: '📈', label: 'Desempenho',  roles: ['admin'] },
  { to: '/users',     icon: '👥', label: 'Usuários',    roles: ['admin'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Fecha o menu ao trocar de página no mobile
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {/* ── Botão hamburguer fixo — só visível no mobile/tablet ── */}
      {!isOpen && (
        <button
          className="sidebar-toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir menu"
          id="btn-sidebar-toggle"
        >
          <span className="hamburger-icon">
            <span />
            <span />
            <span />
          </span>
        </button>
      )}

      {/* ── Botão X fixo — canto sup. direito DO DRAWER ────────── */}
      {isOpen && (
        <button
          className="sidebar-close-btn"
          onClick={() => setIsOpen(false)}
          aria-label="Fechar menu"
          id="btn-sidebar-close"
        >
          ✕
        </button>
      )}

      {/* ── Overlay escuro ────────────────────────────────────── */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
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
    </>
  );
}
