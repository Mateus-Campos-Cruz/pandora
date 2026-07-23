import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { Alert, EmptyState } from '../../components/common/UI';
import { usePolling } from '../../hooks/usePolling';

function minutesSince(openedAt) {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
}

export default function OrdersPage() {
  const [orders, setOrders]   = useState([]);
  const [filter, setFilter]   = useState('all');
  const [error, setError]     = useState(null);
  
  const navigate = useNavigate();
  const alreadyBeepedRef = useRef(new Set());

  const playBeep = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Browsers podem bloquear AudioContext se o usuário não interagiu ainda.
      console.warn('Autoplay do beep bloqueado pelo navegador.');
    }
  }, []);

  const handleAtualizacao = useCallback((data) => {
    if (!data.pedidos) return;

    setOrders(prev => {
      let next = [...prev];
      let needsSort = false;
      let shouldBeep = false;
      const isFirstLoad = prev.length === 0;

      data.pedidos.forEach(p => {
        const mapped = {
          id: p.id,
          type: p.tipo,
          status: p.status,
          opened_at: p.aberto_em,
          table_identifier: p.mesa_numero,
          customer_name: p.cliente_nome,
          customer_phone: p.cliente_telefone,
          attendant_name: p.atendente_nome,
          item_count: p.itens.filter(i => !i.cancelado).length,
          total: p.itens.reduce((acc, i) => acc + (i.cancelado ? 0 : (parseFloat(i.preco_unitario) || 0) * i.quantidade), 0)
        };

        const existingIdx = next.findIndex(o => o.id === p.id);

        if (p.status === 'encerrado') {
          if (existingIdx !== -1) next.splice(existingIdx, 1);
        } else {
          if (existingIdx !== -1) {
            next[existingIdx] = mapped;
          } else {
            next.push(mapped);
            needsSort = true;
          }

          if (mapped.status === 'pronto' && !alreadyBeepedRef.current.has(mapped.id)) {
             alreadyBeepedRef.current.add(mapped.id);
             if (!isFirstLoad) {
                shouldBeep = true;
             }
          }
        }
      });

      if (shouldBeep) {
         playBeep();
      }

      if (needsSort) {
        next.sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
      }
      return next;
    });
  }, [playBeep]);

  const { carregando, semConexao } = usePolling('/pedidos/atualizacoes', handleAtualizacao);

  const filtered = filter === 'all' ? orders : orders.filter(o =>
    filter === 'late' ? minutesSince(o.opened_at) > 30 : o.type === filter
  );

  return (
    <div>
      <style>{`
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
        .badge-pronto-entrega {
           display: inline-block;
           margin-top: 6px;
           font-size: 10px;
           padding: 2px 6px;
           border-radius: 4px;
           background: rgba(34, 197, 94, 0.2);
           color: var(--success);
           font-weight: 700;
           animation: pulse-success 1.5s infinite;
        }
      `}</style>
      
      <div className="page-header">
        <div className="page-header-left">
          <h2>📋 Pedidos Ativos</h2>
          <p>{orders.length} pedido(s) em andamento</p>
        </div>
        <div className="flex gap-4 flex-wrap items-center">
          <div className="connection-indicator">
            {semConexao ? (
               <><div className="dot offline" /> <span style={{color: '#ef4444'}}>Sem conexão</span></>
            ) : (
               <><div className="dot online" /> <span style={{color: '#10b981'}}>Ao vivo</span></>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/orders/new')} id="btn-new-order-from-list">+ Novo Pedido</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap filters-bar" style={{ marginBottom: '20px' }}>
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
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      {!orders.length && carregando && (
         <div style={{ textAlign: 'center', padding: '40px' }}>Carregando pedidos...</div>
      )}

      {orders.length > 0 && filtered.length === 0 ? (
        <EmptyState icon="📭" title="Nenhum pedido encontrado no filtro selecionado" />
      ) : null}
      
      {orders.length === 0 && !carregando ? (
        <EmptyState icon="📭" title="Nenhum pedido ativo no momento" />
      ) : null}

      {filtered.length > 0 && (
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
                <th className="hide-mobile">Atendente</th>
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
                    <td>
                      <div className="flex flex-col items-start">
                        <StatusBadge status={order.status} />
                        {order.status === 'pronto' && (
                          <div className="badge-pronto-entrega">
                            PRONTO PARA ENTREGAR
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ color: isLate ? 'var(--warning)' : 'var(--text-muted)', fontSize: '12px', fontWeight: isLate ? '700' : '400' }}>
                        {formatDistanceToNow(new Date(order.opened_at), { locale: ptBR })} {isLate && '⚠️'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }} className="hide-mobile">{order.attendant_name || '—'}</td>
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
