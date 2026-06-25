const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticação JWT.
 * Extrai o token do header Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token de autenticação não fornecido.',
      code: 'AUTH_TOKEN_MISSING',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Sessão expirada. Faça login novamente.',
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      error: 'Token inválido.',
      code: 'AUTH_TOKEN_INVALID',
    });
  }
}

module.exports = { authenticate };
