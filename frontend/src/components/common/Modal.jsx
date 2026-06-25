export default function Modal({ title, children, footer, onClose, size = 'md' }) {
  const maxWidths = { sm: '400px', md: '520px', lg: '720px' };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal" style={{ maxWidth: maxWidths[size] }}>
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
          {onClose && (
            <button
              className="btn btn-ghost btn-icon"
              onClick={onClose}
              aria-label="Fechar modal"
              id="btn-modal-close"
            >
              ✕
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
