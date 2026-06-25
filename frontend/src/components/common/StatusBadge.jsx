export function StatusBadge({ status }) {
  const labels = {
    recebido:   '⏳ Recebido',
    em_preparo: '🔥 Em Preparo',
    pronto:     '✅ Pronto',
    entregue:   '🚚 Entregue',
    encerrado:  '✔ Encerrado',
  };

  return (
    <span className={`badge badge-${status}`}>
      {labels[status] || status}
    </span>
  );
}

export function TypeBadge({ type }) {
  return (
    <span className={`badge badge-${type}`}>
      {type === 'salao' ? '🪑 Salão' : '🛵 Delivery'}
    </span>
  );
}

export function TableStatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {status === 'livre' ? '✓ Livre' : '● Ocupada'}
    </span>
  );
}
