/**
 * Middleware de autorização baseada em perfil (RBAC).
 * Uso: authorize('admin') ou authorize('admin', 'atendente')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado.',
        code: 'AUTH_NOT_AUTHENTICATED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso negado. Perfil '${req.user.role}' não tem permissão para esta operação.`,
        code: 'AUTH_FORBIDDEN',
        requiredRoles: roles,
      });
    }

    next();
  };
}

module.exports = { authorize };
