import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Alert, EmptyState } from '../../components/common/UI';
import { usePolling } from '../../hooks/usePolling';

function minutesSince(openedAt) {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
}

function formatTime(dt) {
  if (!dt) return '';
  return format(new Date(dt), 'HH:mm', { locale: ptBR });
}

const statusNext = {
  recebido:   { label: '▶ Iniciar Preparo', next: 'em_preparo' },
  em_preparo: { label: '✅ Marcar Pronto',  next: 'pronto' },
};

export default function KitchenPage() {
  const [queue, setQueue]     = useState([]);
  const [error, setError]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [advancing, setAdvancing] = useState({});

  const handleAtualizacao = useCallback((data) => {
    if (!data.pedidos) return;

    setQueue(prev => {
      let next = [...prev];
      let needsSort = false;

      data.pedidos.forEach(p => {
        const mapped = {
          id: p.id,
          type: p.tipo,
          status: p.status,
          opened_at: p.aberto_em,
          table_identifier: p.mesa_numero,
          customer_name: p.cliente_nome,
          items: p.itens
            .filter(i => i.categoria !== 'bebida')
            .map(i => ({
              id: i.id,
              item_name: i.nome,
              category: i.categoria,
              quantity: i.quantidade,
              observation: i.observacao,
              is_cancelled: i.cancelado
            }))
        };

        const validStatuses = ['recebido', 'em_preparo', 'pronto'];
        const existingIdx = next.findIndex(o => o.id === p.id);

        if (!validStatuses.includes(p.status)) {
          // Se mudou para um status fora da cozinha (ex: entregue), removemos da fila
          if (existingIdx !== -1) {
             next.splice(existingIdx, 1);
          }
        } else {
          if (existingIdx !== -1) {
            // Atualiza existente e dispara animação se o status mudou
            if (next[existingIdx].status !== mapped.status) {
                mapped.isUpdated = true;
            }
            next[existingIdx] = mapped;
          } else {
            // Novo pedido entra na fila com animação
            mapped.isNew = true;
            next.push(mapped);
            needsSort = true;
          }
        }
      });

      if (needsSort) {
        next.sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
      }
      return next;
    });
    setLastUpdate(new Date());
  }, []);

  const { carregando, semConexao } = usePolling('/pedidos/atualizacoes', handleAtualizacao);

  // Limpa as flags de animação após 3 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
       setQueue(prev => {
         if (!prev.some(o => o.isNew || o.isUpdated)) return prev;
         return prev.map(o => ({ ...o, isNew: false, isUpdated: false }));
       });
    }, 3000);
    return () => clearTimeout(timer);
  }, [queue]);

  const handleAdvance = async (orderId, currentStatus) => {
    if (advancing[orderId]) return;
    setAdvancing(a => ({ ...a, [orderId]: true }));
    try {
      await api.patch(`/orders/${orderId}/status`);
      // Não fazemos fetchManual. O polling ou o retorno atualizarão.
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar status.');
    } finally {
      setAdvancing(a => { const n = { ...a }; delete n[orderId]; return n; });
    }
  };

  const prontos = queue.filter(o => o.status === 'pronto');

  return (
    <div className="kitchen-page">
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes highlight-badge {
          0% { transform: scale(1); box-shadow: none; }
          50% { transform: scale(1.1); box-shadow: 0 0 12px var(--primary); }
          100% { transform: scale(1); box-shadow: none; }
        }
        .anim-new-order {
          animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-updated-status .status-badge-container {
          animation: highlight-badge 1s ease-out;
        }
        .connection-indicator {
           display: inline-flex;
           align-items: center;
           gap: 6px;
           padding: 6px 12px;
           border-radius: 20px;
           background: rgba(0,0,0,0.2);
           font-size: 13px;
           font-weight: 500;
        }
        .dot {
           width: 8px; height: 8px; border-radius: 50%;
        }
        .dot.online { background: #10b981; box-shadow: 0 0 8px #10b981; animation: pulse-success 2s infinite; }
        .dot.offline { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
      `}</style>
      
      {/* Header */}
      <div className="kitchen-header">
        <div>
          <h1 className="kitchen-title">👨‍🍳 Cozinha</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {queue.length} pedido(s) na fila
            {lastUpdate && ` · Atualizado às ${formatTime(lastUpdate)}`}
          </p>
        </div>
        
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-3 items-center">
            <LegendItem color="var(--salao)" label="🪑 Salão" />
            <LegendItem color="var(--delivery)" label="🛵 Delivery" />
          </div>
          
          <div className="connection-indicator">
            {semConexao ? (
               <><div className="dot offline" /> <span style={{color: '#ef4444'}}>Sem conexão</span></>
            ) : (
               <><div className="dot online" /> <span style={{color: '#10b981'}}>Ao vivo</span></>
            )}
          </div>
        </div>
      </div>

      {prontos.length > 0 && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          <span>✅</span>
          <span><strong>{prontos.length} pedido(s) PRONTO(S)</strong> aguardando retirada.</span>
        </div>
      )}

      {error && <Alert type="danger">{error}</Alert>}

      {!lastUpdate && carregando && (
         <div style={{ textAlign: 'center', padding: '40px' }}>Carregando fila...</div>
      )}

      {/* Fila */}
      {lastUpdate && queue.length === 0 && !error && (
        <EmptyState icon="✅" title="Fila vazia" description="Nenhum pedido ativo no momento." />
      )}

      {queue.length > 0 && (
        <div className="kitchen-grid">
          {queue.map(order => {
            const mins    = minutesSince(order.opened_at);
            const isLate  = mins > 30;
            const action  = statusNext[order.status];
            const activeItems = (order.items || []).filter(i => !i.is_cancelled && i.category !== 'bebida');

            let classes = `kitchen-card type-${order.type} status-${order.status}`;
            if (order.isNew) classes += ' anim-new-order';
            if (order.isUpdated) classes += ' anim-updated-status';

            return (
              <div
                key={order.id}
                className={classes}
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
                    <div className="status-badge-container">
                       <StatusBadge status={order.status} />
                    </div>
                    {order.status === 'pronto' && (
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700', animation: 'pulse-success 1.5s infinite' }}>
                        PRONTO!
                      </span>
                    )}
                  </div>
                </div>

                <div className="kitchen-items">
                  {activeItems.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>Sem itens.</p>
                  )}
                  {activeItems.map(item => (
                    <div key={item.id} className="kitchen-item">
                      <div className="kitchen-item-qty">{item.quantity}</div>
                      <div className="kitchen-item-details">
                        <div className="kitchen-item-name">{item.item_name}</div>
                        {item.observation && (
                          <div className="kitchen-item-obs">⚠️ {item.observation}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {action && (
                  <div className="kitchen-card-footer">
                    <button
                      className="btn btn-primary w-full"
                      style={{ justifyContent: 'center' }}
                      onClick={() => handleAdvance(order.id, order.status)}
                      disabled={!!advancing[order.id]}
                    >
                      {advancing[order.id] ? 'Atualizando...' : action.label}
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
