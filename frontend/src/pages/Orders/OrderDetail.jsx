import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import { Spinner, Alert } from '../../components/common/UI';
import Modal from '../../components/common/Modal';

const statusLabels = {
  recebido:   'Em Preparo',
  em_preparo: 'Pronto',
  pronto:     'Entregue',
  entregue:   'Encerrar',
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAtendente, isAdmin } = useAuth();

  const [order, setOrder]         = useState(null);
  const [items, setItems]         = useState([]);
  const [menu, setMenu]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Modal: Adicionar item
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem]         = useState({ menu_item_id: '', quantity: 1, observation: '' });
  const [savingItem, setSavingItem]   = useState(false);

  // Modal: Editar/Cancelar item
  const [editTarget, setEditTarget] = useState(null);
  const [editAction, setEditAction] = useState('edit');
  const [editForm, setEditForm]     = useState({ quantity: 1, observation: '', justification: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Atualizar status
  const [advancingStatus, setAdvancingStatus] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
      setItems(data.items || []);
      setError(null);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Pedido não encontrado.' : 'Erro ao carregar pedido.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  useEffect(() => {
    if (showAddItem && menu.length === 0) {
      api.get('/menu?active=true').then(({ data }) => setMenu(data.items || []));
    }
  }, [showAddItem]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.menu_item_id || newItem.quantity < 1) return;
    setSavingItem(true);
    try {
      await api.post(`/orders/${id}/items`, newItem);
      setShowAddItem(false);
      setNewItem({ menu_item_id: '', quantity: 1, observation: '' });
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao adicionar item.');
    } finally {
      setSavingItem(false);
    }
  };

  const openEdit = (item, action) => {
    setEditTarget(item);
    setEditAction(action);
    setEditForm({ quantity: item.quantity, observation: item.observation || '', justification: '' });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.justification.trim() || editForm.justification.trim().length < 5) {
      alert('Justificativa obrigatória (mínimo 5 caracteres).');
      return;
    }
    setSavingEdit(true);
    try {
      await api.patch(`/orders/${id}/items/${editTarget.id}`, {
        action: editAction,
        justification: editForm.justification,
        ...(editAction === 'edit' ? {
          quantity: editForm.quantity,
          observation: editForm.observation,
        } : {}),
      });
      setEditTarget(null);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao editar item.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAdvanceStatus = async () => {
    if (!window.confirm(`Confirma avançar o status do pedido?`)) return;
    setAdvancingStatus(true);
    try {
      await api.patch(`/orders/${id}/status`);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar status.');
    } finally {
      setAdvancingStatus(false);
    }
  };

  if (loading) return <Spinner />;
  if (error)   return <div className="page-content"><Alert type="danger">{error}</Alert></div>;
  if (!order)  return null;

  const isEditable = ['recebido', 'em_preparo'].includes(order.status);
  const canAdvance = isAtendente && statusLabels[order.status];
  const activeItems = items.filter(i => !i.is_cancelled);
  const total = activeItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: '8px' }} id="btn-back">
            ← Voltar
          </button>
          <h2>
            {order.type === 'salao' ? `🪑 ${order.table_identifier}` : `🛵 ${order.customer_name}`}
          </h2>
          <div className="flex gap-2 items-center" style={{ marginTop: '6px' }}>
            <TypeBadge type={order.type} />
            <StatusBadge status={order.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {isEditable && isAtendente && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddItem(true)}
              id="btn-add-item"
            >
              + Adicionar Item
            </button>
          )}
          {canAdvance && (
            <button
              className="btn btn-secondary"
              onClick={handleAdvanceStatus}
              disabled={advancingStatus}
              id="btn-advance-status"
              style={{
                borderColor: order.status === 'entregue' ? 'var(--success)' : undefined,
                color: order.status === 'entregue' ? 'var(--success)' : undefined,
              }}
            >
              {advancingStatus ? '...' : `→ ${statusLabels[order.status]}`}
            </button>
          )}
        </div>
      </div>

      {/* Info delivery */}
      {order.type === 'delivery' && (
        <div className="card mb-4" style={{ marginBottom: '16px' }}>
          <div className="flex gap-6 flex-wrap">
            <InfoItem label="Cliente" value={order.customer_name} />
            <InfoItem label="Telefone" value={order.customer_phone} />
            <InfoItem label="Endereço" value={order.customer_address} />
          </div>
        </div>
      )}

      {/* Itens */}
      <div className="card">
        <div className="flex items-center justify-between mb-4" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Itens do Pedido</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {activeItems.length} item(s) · R$ {total.toFixed(2)}
          </span>
        </div>

        {items.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
            Nenhum item adicionado ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', background: '#F5A623',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                  color: '#000000',
                  opacity: item.is_cancelled ? 0.4 : 1,
                }}
                id={`item-row-${item.id}`}
              >
                <span style={{ fontWeight: '800', color: '#000000', minWidth: '28px', fontSize: '16px' }}>
                  {item.quantity}×
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#000000', textDecoration: item.is_cancelled ? 'line-through' : 'none' }}>
                    {item.item_name}
                  </div>
                  {item.observation && (
                    <div style={{ fontSize: '12px', color: '#3E1F00', marginTop: '2px', fontWeight: '500' }}>
                      📝 {item.observation}
                    </div>
                  )}
                  {item.is_cancelled && (
                    <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '600' }}>Cancelado</div>
                  )}
                </div>
                <span style={{ fontWeight: '700', color: '#000000', minWidth: '70px', textAlign: 'right' }}>
                  R$ {(item.unit_price * item.quantity).toFixed(2)}
                </span>
                {isEditable && isAtendente && !item.is_cancelled && (
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item, 'edit')} id={`btn-edit-item-${item.id}`} title="Editar">✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => openEdit(item, 'cancel')} id={`btn-cancel-item-${item.id}`} title="Cancelar">✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="divider" />
        <div className="flex justify-between items-center">
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Total do Pedido</span>
          <span style={{ fontWeight: '800', fontSize: '20px' }}>R$ {total.toFixed(2)}</span>
        </div>
      </div>

      {/* Modal: Adicionar Item */}
      {showAddItem && (
        <Modal
          title="Adicionar Item"
          onClose={() => setShowAddItem(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAddItem(false)} id="btn-cancel-add-item">Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddItem} disabled={savingItem} id="btn-save-add-item">
                {savingItem ? 'Adicionando...' : 'Adicionar'}
              </button>
            </>
          }
        >
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="item-select">Item do Cardápio <span className="form-required">*</span></label>
            <select
              id="item-select"
              className="form-select"
              value={newItem.menu_item_id}
              onChange={e => setNewItem(n => ({ ...n, menu_item_id: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {['prato_principal','bebida','sobremesa','adicional'].map(cat => {
                const catItems = menu.filter(m => m.category === cat);
                if (!catItems.length) return null;
                const catLabel = { prato_principal: '🍽️ Pratos', bebida: '🥤 Bebidas', sobremesa: '🍰 Sobremesas', adicional: '➕ Adicionais' };
                return (
                  <optgroup key={cat} label={catLabel[cat]}>
                    {catItems.map(m => (
                      <option key={m.id} value={m.id}>{m.name} — R$ {Number(m.price).toFixed(2)}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="item-qty">Quantidade <span className="form-required">*</span></label>
            <input id="item-qty" type="number" min={1} max={99} className="form-input" value={newItem.quantity}
              onChange={e => setNewItem(n => ({ ...n, quantity: parseInt(e.target.value) || 1 }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="item-obs">Observação</label>
            <input id="item-obs" type="text" className="form-input" placeholder="ex: sem cebola, ponto mal passado..." value={newItem.observation}
              onChange={e => setNewItem(n => ({ ...n, observation: e.target.value }))} />
          </div>
        </Modal>
      )}

      {/* Modal: Editar/Cancelar Item */}
      {editTarget && (
        <Modal
          title={editAction === 'edit' ? `Editar: ${editTarget.item_name}` : `Cancelar: ${editTarget.item_name}`}
          onClose={() => setEditTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditTarget(null)} id="btn-cancel-edit">Cancelar</button>
              <button
                className={`btn ${editAction === 'cancel' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleEdit}
                disabled={savingEdit}
                id="btn-save-edit"
              >
                {savingEdit ? '...' : editAction === 'cancel' ? 'Confirmar Cancelamento' : 'Salvar Edição'}
              </button>
            </>
          }
        >
          {editAction === 'cancel' && (
            <div className="alert alert-danger">Este item será marcado como cancelado e não será cobrado.</div>
          )}

          {editAction === 'edit' && (
            <>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="edit-qty">Quantidade</label>
                <input id="edit-qty" type="number" min={1} className="form-input"
                  value={editForm.quantity}
                  onChange={e => setEditForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="edit-obs">Observação</label>
                <input id="edit-obs" type="text" className="form-input"
                  value={editForm.observation}
                  onChange={e => setEditForm(f => ({ ...f, observation: e.target.value }))} />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="edit-justification">
              Justificativa <span className="form-required">*</span>
            </label>
            <textarea id="edit-justification" className="form-textarea"
              placeholder="Motivo da alteração (obrigatório, mínimo 5 caracteres)"
              value={editForm.justification}
              onChange={e => setEditForm(f => ({ ...f, justification: e.target.value }))}
              required
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: '500', marginTop: '2px' }}>{value}</div>
    </div>
  );
}
