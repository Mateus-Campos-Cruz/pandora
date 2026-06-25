import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ProtectedRoute — Protege rotas por autenticação e perfil.
 * @param {string[]} roles - Perfis permitidos (undefined = todos autenticados)
 * @param {string}   redirectTo - Redireciona se não autorizado
 */
export default function ProtectedRoute({ children, roles, redirectTo = '/login' }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    // Redireciona cozinha para /kitchen se tentar acessar área restrita
    if (user.role === 'cozinha') {
      return <Navigate to="/kitchen" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
