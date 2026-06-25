import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';

function minutesSince(openedAt) {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
}

function formatTime(dt) {
  return format(new Date(dt), 'HH:mm', { locale: ptBR });
}

const statusNext = {
  recebido:   { label: '▶ Iniciar Preparo', next: 'em_preparo' },
  em_preparo: { label: '✅ Marcar Pronto',  next: 'pronto' },
};

export default function KitchenPage() {
  const [queue, setQueue]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [advancing, setAdvancing] = useState({});

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/kitchen/queue');
      setQueue(data.queue || []);
      setLastUpdate(new Date());
    } catch {
      setError('Erro ao carregar fila. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdvance = async (orderId, currentStatus) => {
    if (advancing[orderId]) return;
    setAdvancing(a => ({ ...a, [orderId]: true }));
    try {
      await api.patch(`/orders/${orderId}/status`);
      fetchQueue();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar status.');
    } finally {
      setAdvancing(a => { const n = { ...a }; delete n[orderId]; return n; });
    }
  };

  const prontos = queue.filter(o => o.status === 'pronto');

  return (
    <div className="kitchen-page">
      {/* Header */}
      <div className="kitchen-header">
        <div>
          <h1 className="kitchen-title">👨‍🍳 Cozinha</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {queue.length} pedido(s) na fila
            {lastUpdate && ` · Atualizado às ${formatTime(lastUpdate)}`}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-3 items-center" style={{ marginRight: '8px' }}>
            <LegendItem color="var(--salao)" label="🪑 Salão" />
            <LegendItem color="var(--delivery)" label="🛵 Delivery" />
          </div>
          <button
            className="btn btn-primary"
            onClick={fetchQueue}
            disabled={loading}
            id="btn-kitchen-refresh"
            style={{ minWidth: '140px', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Carregando...
              </>
            ) : '🔄 Atualizar Fila'}
          </button>
        </div>
      </div>

      {/* Alerta: prontos */}
      {prontos.length > 0 && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          <span>✅</span>
          <span><strong>{prontos.length} pedido(s) PRONTO(S)</strong> aguardando retirada pelo atendente.</span>
        </div>
      )}

      {error && <Alert type="danger">{error}</Alert>}

      {/* Estado inicial */}
      {!lastUpdate && !loading && !error && (
        <EmptyState
          icon="👨‍🍳"
          title="Clique em 'Atualizar Fila' para carregar"
          description="A fila da cozinha é atualizada manualmente para maior controle."
          action={
            <button className="btn btn-primary" onClick={fetchQueue} id="btn-initial-load">
              🔄 Carregar Fila
            </button>
          }
        />
      )}

      {/* Fila */}
      {lastUpdate && !loading && queue.length === 0 && !error && (
        <EmptyState icon="✅" title="Fila vazia" description="Nenhum pedido ativo no momento." />
      )}

      {queue.length > 0 && (
        <div className="kitchen-grid">
          {queue.map(order => {
            const mins    = minutesSince(order.opened_at);
            const isLate  = mins > 30;
            const action  = statusNext[order.status];
            const activeItems = (order.items || []).filter(i => !i.is_cancelled);

            return (
              <div
                key={order.id}
                className={`kitchen-card type-${order.type} status-${order.status}`}
                id={`kitchen-order-${order.id}`}
              >
                <div className="kitchen-card-header">
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2 items-center">
                      <span style={{ fontSize: '18px' }}>{order.type === 'salao' ? '🪑' : '🛵'}</span>
                      <span className="kitchen-card-id">
                        {order.type === 'salao' ? order.table_identifier : order.customer_name}
                      </span>
                    </div>
                    <span className="kitchen-card-time">
                      🕐 {formatTime(order.opened_at)} · {mins}min {isLate && '⚠️'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1" style={{ alignItems: 'flex-end' }}>
                    <StatusBadge status={order.status} />
                    {order.status === 'pronto' && (
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700', animation: 'pulse-success 1.5s infinite' }}>
                        PRONTO!
                      </span>
                    )}
                  </div>
                </div>

                {/* Itens */}
                <div className="kitchen-items">
                  {activeItems.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>Sem itens.</p>
                  )}
                  {(order.items || []).map(item => (
                    <div key={item.id} className={`kitchen-item ${item.is_cancelled ? 'cancelled' : ''}`} id={`kitchen-item-${item.id}`}>
                      <div className="kitchen-item-qty">{item.quantity}</div>
                      <div className="kitchen-item-details">
                        <div className="kitchen-item-name">
                          {item.is_cancelled && '❌ '}{item.item_name}
                        </div>
                        {item.observation && (
                          <div className="kitchen-item-obs">⚠️ {item.observation}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ação */}
                {action && (
                  <div className="kitchen-card-footer">
                    <button
                      className="btn btn-primary w-full"
                      style={{ justifyContent: 'center' }}
                      onClick={() => handleAdvance(order.id, order.status)}
                      disabled={!!advancing[order.id]}
                      id={`btn-advance-${order.id}`}
                    >
                      {advancing[order.id] ? '...' : action.label}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, display: 'inline-block' }} />
      {label}
    </div>
  );
}
