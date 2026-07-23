import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';

export default function HistoryPage() {
  const [orders, setOrders]   = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [filters, setFilters] = useState({ date: '', type: '', page: 1 });
  const [searched, setSearched] = useState(false);

  const fetchHistory = useCallback(async (f = filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.date) params.append('date', f.date);
      if (f.type) params.append('type', f.type);
      params.append('page', f.page);
      params.append('limit', 20);

      const { data } = await api.get(`/history?${params}`);
      setOrders(data.orders || []);
      setPagination(data.pagination);
      setSearched(true);
    } catch {
      setError('Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleSearch = (e) => {
    e.preventDefault();
    const f = { ...filters, page: 1 };
    setFilters(f);
    fetchHistory(f);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>📁 Histórico de Pedidos</h2>
          <p>Consulta de pedidos encerrados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <form onSubmit={handleSearch} className="flex gap-3 flex-wrap items-center">
          <div className="form-group" style={{ minWidth: '160px', flex: '1' }}>
            <label className="form-label" htmlFor="hist-date">Data</label>
            <input
              id="hist-date"
              type="date"
              className="form-input"
              value={filters.date}
              onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ minWidth: '140px', flex: '1' }}>
            <label className="form-label" htmlFor="hist-type">Canal</label>
            <select id="hist-type" className="form-select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">Todos</option>
              <option value="salao">🪑 Salão</option>
              <option value="delivery">🛵 Delivery</option>
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} id="btn-search-history">
              {loading ? 'Buscando...' : '🔍 Buscar'}
            </button>
          </div>
        </form>
      </div>

      {error && <Alert type="danger">{error}</Alert>}
      {loading && <Spinner />}

      {!loading && searched && orders.length === 0 && (
        <EmptyState icon="📭" title="Nenhum pedido encontrado" description="Tente outros filtros." />
      )}

      {!loading && orders.length > 0 && (
        <>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            {pagination?.total} resultado(s) — Página {pagination?.page} de {pagination?.pages}
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Identificação</th>
                  <th>Itens</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Abertura</th>
                  <th className="hide-mobile">Encerramento</th>
                  <th className="hide-mobile">Atendente</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} id={`hist-row-${order.id}`}>
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
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {format(new Date(order.opened_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }} className="hide-mobile">
                      {order.closed_at ? format(new Date(order.closed_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                    </td>
                    <td style={{ fontSize: '12px' }} className="hide-mobile">{order.attendant_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {pagination && pagination.pages > 1 && (
            <div className="flex gap-2 justify-end" style={{ marginTop: '16px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={filters.page <= 1}
                onClick={() => { const f = { ...filters, page: filters.page - 1 }; setFilters(f); fetchHistory(f); }}
                id="btn-prev-page"
              >← Anterior</button>
              <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                {pagination.page}/{pagination.pages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={filters.page >= pagination.pages}
                onClick={() => { const f = { ...filters, page: filters.page + 1 }; setFilters(f); fetchHistory(f); }}
                id="btn-next-page"
              >Próxima →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
