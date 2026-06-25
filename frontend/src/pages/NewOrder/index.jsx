import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Spinner, Alert } from '../../components/common/UI';

const EMPTY_DELIVERY = { customer_name: '', customer_phone: '', customer_address: '' };

export default function NewOrderPage() {
  const [type, setType]     = useState('salao');
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState('');
  const [delivery, setDelivery] = useState(EMPTY_DELIVERY);
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (type === 'salao') {
      setLoadingTables(true);
      api.get('/tables')
        .then(({ data }) => {
          setTables(data.tables?.filter(t => t.status === 'livre') || []);
        })
        .finally(() => setLoadingTables(false));
    }
  }, [type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (type === 'salao' && !tableId) {
      setError('Selecione uma mesa.');
      return;
    }

    if (type === 'delivery') {
      if (!delivery.customer_name.trim()) { setError('Nome do cliente é obrigatório.'); return; }
      if (!delivery.customer_phone.trim()) { setError('Telefone é obrigatório.'); return; }
      if (!delivery.customer_address.trim()) { setError('Endereço é obrigatório.'); return; }
    }

    setSaving(true);
    try {
      const payload = {
        type,
        notes: notes.trim() || undefined,
        ...(type === 'salao' ? { table_id: tableId } : delivery),
      };
      const { data } = await api.post('/orders', payload);
      navigate(`/orders/${data.order.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao abrir pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>+ Novo Pedido</h2>
          <p>Preencha as informações para abrir o pedido</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} noValidate>

          {/* Tipo */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Tipo de Atendimento</label>
            <div className="flex gap-2" style={{ marginTop: '8px' }}>
              <TypeToggle
                active={type === 'salao'}
                icon="🪑" label="Salão"
                onClick={() => setType('salao')}
                id="toggle-salao"
                color="var(--salao)"
              />
              <TypeToggle
                active={type === 'delivery'}
                icon="🛵" label="Delivery"
                onClick={() => setType('delivery')}
                id="toggle-delivery"
                color="var(--delivery)"
              />
            </div>
          </div>

          {/* Salão: Mesa */}
          {type === 'salao' && (
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="order-table">
                Mesa <span className="form-required">*</span>
              </label>
              {loadingTables ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Carregando mesas...</div>
              ) : tables.length === 0 ? (
                <div className="alert alert-warning">Nenhuma mesa livre no momento.</div>
              ) : (
                <select
                  id="order-table"
                  className="form-select"
                  value={tableId}
                  onChange={e => setTableId(e.target.value)}
                  required
                >
                  <option value="">Selecione a mesa...</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>{t.identifier} ({t.capacity} lugares)</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Delivery: Dados do cliente */}
          {type === 'delivery' && (
            <div style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="customer-name">
                  Nome do Cliente <span className="form-required">*</span>
                </label>
                <input
                  id="customer-name"
                  className="form-input"
                  placeholder="Nome completo"
                  value={delivery.customer_name}
                  onChange={e => setDelivery(d => ({ ...d, customer_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="customer-phone">
                  Telefone <span className="form-required">*</span>
                </label>
                <input
                  id="customer-phone"
                  className="form-input"
                  placeholder="(11) 99999-9999"
                  value={delivery.customer_phone}
                  onChange={e => setDelivery(d => ({ ...d, customer_phone: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="customer-address">
                  Endereço de Entrega <span className="form-required">*</span>
                </label>
                <textarea
                  id="customer-address"
                  className="form-textarea"
                  placeholder="Rua, número, bairro, complemento..."
                  value={delivery.customer_address}
                  onChange={e => setDelivery(d => ({ ...d, customer_address: e.target.value }))}
                  required
                />
              </div>
            </div>
          )}

          {/* Observação geral */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="order-notes">Observação (opcional)</label>
            <textarea
              id="order-notes"
              className="form-textarea"
              placeholder="Alguma observação sobre o pedido..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <div style={{ marginBottom: '16px' }}><Alert type="danger">{error}</Alert></div>}

          <div className="flex gap-3 justify-end">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)} id="btn-cancel-order">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="btn-create-order">
              {saving ? 'Abrindo...' : '✓ Abrir Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TypeToggle({ active, icon, label, onClick, id, color }) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        border: `2px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}22` : 'var(--bg-2)',
        color: active ? color : 'var(--text-muted)',
        fontSize: '15px',
        fontWeight: '700',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '28px' }}>{icon}</span>
      {label}
    </button>
  );
}
