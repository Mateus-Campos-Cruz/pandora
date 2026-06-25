import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';

function minutesSince(openedAt) {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
}

export default function OrdersPage() {
  const [orders, setOrders]   = useState([]);
  const [filter, setFilter]   = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data.orders || []);
      setError(null);
    } catch {
      setError('Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = filter === 'all' ? orders : orders.filter(o =>
    filter === 'late' ? minutesSince(o.opened_at) > 30 : o.type === filter
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>📋 Pedidos Ativos</h2>
          <p>{orders.length} pedido(s) em andamento</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={fetchOrders} id="btn-refresh-orders">🔄 Atualizar</button>
          <button className="btn btn-primary" onClick={() => navigate('/orders/new')} id="btn-new-order-from-list">+ Novo Pedido</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap" style={{ marginBottom: '20px' }}>
        {[
          { key: 'all',      label: 'Todos' },
          { key: 'salao',    label: '🪑 Salão' },
          { key: 'delivery', label: '🛵 Delivery' },
          { key: 'late',     label: '⚠️ +30min' },
        ].map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f.key)}
            id={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      {filtered.length === 0 ? (
        <EmptyState icon="📭" title="Nenhum pedido encontrado" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Identificação</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Status</th>
                <th>Tempo</th>
                <th>Atendente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const mins    = minutesSince(order.opened_at);
                const isLate  = mins > 30;
                return (
                  <tr
                    key={order.id}
                    style={{ background: order.status === 'pronto' ? 'rgba(34,197,94,0.05)' : isLate ? 'rgba(245,158,11,0.05)' : '' }}
                    id={`order-row-${order.id}`}
                  >
                    <td><TypeBadge type={order.type} /></td>
                    <td>
                      <strong>{order.type === 'salao' ? order.table_identifier : order.customer_name}</strong>
                      {order.type === 'delivery' && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{order.customer_phone}</div>
                      )}
                    </td>
                    <td>{order.item_count ?? 0}</td>
                    <td style={{ fontWeight: '700' }}>
                      {order.total > 0 ? `R$ ${Number(order.total).toFixed(2)}` : '—'}
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <span style={{ color: isLate ? 'var(--warning)' : 'var(--text-muted)', fontSize: '12px', fontWeight: isLate ? '700' : '400' }}>
                        {formatDistanceToNow(new Date(order.opened_at), { locale: ptBR })} {isLate && '⚠️'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{order.attendant_name}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/orders/${order.id}`)}
                        id={`btn-view-order-${order.id}`}
                      >
                        Ver →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
