import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';

function elapsed(openedAt) {
  return formatDistanceToNow(new Date(openedAt), { locale: ptBR, addSuffix: false });
}

function minutesSince(openedAt) {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
}

export default function DashboardPage() {
  const [orders, setOrders]   = useState([]);
  const [stats, setStats]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data.orders || []);

      // Calcular stats
      const all = data.orders || [];
      setStats({
        total:     all.length,
        salao:     all.filter(o => o.type === 'salao').length,
        delivery:  all.filter(o => o.type === 'delivery').length,
        prontos:   all.filter(o => o.status === 'pronto').length,
      });
      setError(null);
    } catch (err) {
      setError('Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 60000); // Atualiza stats a cada minuto
    return () => clearInterval(interval);
  }, [fetchOrders]);

  if (loading) return <Spinner />;

  const alertOrders  = orders.filter(o => minutesSince(o.opened_at) > 30);
  const prontoOrders = orders.filter(o => o.status === 'pronto');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Olá, {user?.name?.split(' ')[0]}! 👋</h2>
          <p>Visão geral dos pedidos ativos em tempo real</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/orders/new')}
          id="btn-new-order"
        >
          + Novo Pedido
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-4 mb-6" style={{ marginBottom: '24px' }}>
        <StatCard icon="📋" label="Pedidos Ativos" value={stats.total}    color="var(--primary)" />
        <StatCard icon="🪑" label="Salão"          value={stats.salao}    color="var(--salao)" />
        <StatCard icon="🛵" label="Delivery"       value={stats.delivery} color="var(--delivery)" />
        <StatCard icon="✅" label="Prontos"        value={stats.prontos}  color="var(--success)" />
      </div>

      {/* Alertas */}
      {prontoOrders.length > 0 && (
        <div className="alert alert-success mb-4" style={{ marginBottom: '16px' }}>
          <span>✅</span>
          <span>
            <strong>{prontoOrders.length} pedido(s) PRONTO(S) para entrega!</strong>{' '}
            {prontoOrders.map(o => o.table_identifier || `#${o.id.slice(0,8)}`).join(', ')}
          </span>
        </div>
      )}

      {alertOrders.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
          <span>⚠️</span>
          <span>
            <strong>{alertOrders.length} pedido(s) sem atualização há mais de 30 minutos:</strong>{' '}
            {alertOrders.map(o => o.table_identifier || `#${o.id.slice(0,8)}`).join(', ')}
          </span>
        </div>
      )}

      {error && <Alert type="danger">{error}</Alert>}

      {/* Lista de pedidos */}
      <div style={{ marginTop: '8px' }}>
        <div className="flex items-center justify-between mb-4" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Pedidos Ativos ({orders.length})</h3>
          <button className="btn btn-ghost btn-sm" onClick={fetchOrders} id="btn-refresh-dashboard">
            🔄 Atualizar
          </button>
        </div>

        {orders.length === 0 ? (
          <EmptyState icon="📭" title="Nenhum pedido ativo" description="Abra um novo pedido para começar." />
        ) : (
          <div className="grid grid-auto">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => navigate(`/orders/${order.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}22` }}>
        <span>{icon}</span>
      </div>
      <div className="stat-info">
        <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function OrderCard({ order, onClick }) {
  const mins    = minutesSince(order.opened_at);
  const isLate  = mins > 30;
  const isPront = order.status === 'pronto';

  return (
    <div
      className={`order-card order-${order.type} ${isLate ? 'alert-30min' : ''} ${isPront ? 'alert-pronto' : ''}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      id={`order-card-${order.id}`}
    >
      <div className="order-card-header">
        <div className="order-card-title">
          <TypeBadge type={order.type} />
          <span className="order-id">
            {order.type === 'salao' ? order.table_identifier : order.customer_name}
          </span>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="order-card-body">
        <div className="order-time" style={{ fontSize: '12px', color: isLate ? 'var(--warning)' : 'var(--text-muted)' }}>
          ⏱ {elapsed(order.opened_at)} {isLate && '⚠️'}
        </div>

        <div className="order-items-preview">
          <span className="text-sm text-muted">{order.item_count ?? 0} item(s)</span>
        </div>
      </div>

      <div className="order-card-footer">
        <span className="text-muted text-sm">{order.attendant_name}</span>
        {order.total > 0 && (
          <span className="order-total">
            R$ {Number(order.total).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
