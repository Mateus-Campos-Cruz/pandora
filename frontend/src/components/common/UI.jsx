export function Spinner({ size = 'md' }) {
  return (
    <div className="spinner-overlay">
      <div className={`spinner ${size === 'sm' ? 'spinner-sm' : ''}`} role="status" aria-label="Carregando..." />
    </div>
  );
}

export function Alert({ type = 'info', children, icon }) {
  const icons = { warning: '⚠️', danger: '❌', success: '✅', info: 'ℹ️' };
  return (
    <div className={`alert alert-${type}`} role="alert">
      <span aria-hidden="true">{icon || icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">{icon}</span>
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action}
    </div>
  );
}
