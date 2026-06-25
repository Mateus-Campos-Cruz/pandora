import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from '../../components/common/UI';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const { login, loading }      = useAuth();
  const [localError, setLocalError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const sessionExpired = new URLSearchParams(location.search).get('session') === 'expired';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !password.trim()) {
      setLocalError('Preencha email e senha.');
      return;
    }

    try {
      const user = await login(email.trim(), password);
      // Redireciona por perfil
      if (user.role === 'cozinha') {
        navigate('/kitchen', { replace: true });
      } else {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch (err) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>🍽️ Pandora</h1>
          <p>Sistema de Gestão de Pedidos</p>
        </div>

        {sessionExpired && (
          <div style={{ marginBottom: '16px' }}>
            <Alert type="warning">Sessão encerrada por inatividade. Faça login novamente.</Alert>
          </div>
        )}

        {localError && (
          <div style={{ marginBottom: '16px' }}>
            <Alert type="danger">{localError}</Alert>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email <span className="form-required">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Senha <span className="form-required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: '10px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', color: 'var(--text-muted)',
                  fontSize: '16px', padding: '4px',
                }}
                aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
                id="btn-toggle-password"
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            id="btn-login-submit"
            style={{ marginTop: '8px', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Entrando...
              </>
            ) : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)', marginTop: '24px' }}>
          Pandora v1.0 — Acesso restrito
        </p>
      </div>
    </div>
  );
}
