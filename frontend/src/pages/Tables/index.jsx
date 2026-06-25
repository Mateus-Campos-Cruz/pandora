import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { TableStatusBadge } from '../../components/common/StatusBadge';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';
import Modal from '../../components/common/Modal';

export default function TablesPage() {
  const [tables, setTables]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ identifier: '', capacity: 4 });
  const [saving, setSaving]       = useState(false);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const fetchTables = useCallback(async () => {
    try {
      const { data } = await api.get('/tables');
      setTables(data.tables || []);
      setError(null);
    } catch {
      setError('Erro ao carregar mesas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim()) return;
    setSaving(true);
    try {
      await api.post('/tables', { identifier: form.identifier.trim(), capacity: form.capacity });
      setShowModal(false);
      setForm({ identifier: '', capacity: 4 });
      fetchTables();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar mesa.');
    } finally {
      setSaving(false);
    }
  };

  const handleCardClick = (table) => {
    if (table.active_order_id) {
      navigate(`/orders/${table.active_order_id}`);
    }
  };

  if (loading) return <Spinner />;

  const livres   = tables.filter(t => t.status === 'livre');
  const ocupadas = tables.filter(t => t.status === 'ocupada');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>🪑 Mesas</h2>
          <p>{livres.length} livre(s) · {ocupadas.length} ocupada(s)</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)} id="btn-add-table">
            + Nova Mesa
          </button>
        )}
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      {tables.length === 0 ? (
        <EmptyState icon="🪑" title="Nenhuma mesa cadastrada" />
      ) : (
        <div className="grid grid-auto">
          {tables.map(table => (
            <div
              key={table.id}
              className={`table-card ${table.status}`}
              onClick={() => handleCardClick(table)}
              style={{ cursor: table.active_order_id ? 'pointer' : 'default' }}
              id={`table-card-${table.identifier.replace(/\s/g, '-').toLowerCase()}`}
              role={table.active_order_id ? 'button' : undefined}
              tabIndex={table.active_order_id ? 0 : undefined}
              onKeyDown={e => e.key === 'Enter' && handleCardClick(table)}
              title={table.active_order_id ? 'Clique para ver o pedido' : ''}
            >
              <span className="table-icon">{table.status === 'livre' ? '🟢' : '🔴'}</span>
              <span className="table-name">{table.identifier}</span>
              <TableStatusBadge status={table.status} />
              <span className="table-capacity">👥 {table.capacity} lugares</span>
              {table.active_order_id && (
                <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600' }}>
                  Ver pedido →
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Nova Mesa */}
      {showModal && (
        <Modal
          title="Nova Mesa"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} id="btn-cancel-table">Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving} id="btn-save-table">
                {saving ? 'Salvando...' : 'Criar Mesa'}
              </button>
            </>
          }
        >
          <form onSubmit={handleCreate} noValidate>
            <div className="form-group mb-4" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="table-identifier">
                Identificador <span className="form-required">*</span>
              </label>
              <input
                id="table-identifier"
                className="form-input"
                placeholder="Ex: Mesa 11, Terraço 1, VIP..."
                value={form.identifier}
                onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="table-capacity">Capacidade</label>
              <input
                id="table-capacity"
                type="number"
                className="form-input"
                min={1} max={50}
                value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
