import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';
import Modal from '../../components/common/Modal';

const categories = [
  { key: 'prato_principal', label: '🍽️ Pratos Principais' },
  { key: 'bebida',          label: '🥤 Bebidas' },
  { key: 'sobremesa',       label: '🍰 Sobremesas' },
  { key: 'adicional',       label: '➕ Adicionais' },
];

const EMPTY_FORM = { name: '', category: 'prato_principal', price: '', description: '', is_active: true };

export default function MenuPage() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const { isAdmin } = useAuth();

  const fetchItems = useCallback(async () => {
    try {
      const { data } = await api.get('/menu');
      setItems(data.items || []);
      setError(null);
    } catch {
      setError('Erro ao carregar cardápio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit   = (item) => {
    setEditItem(item);
    setForm({ name: item.name, category: item.category, price: item.price, description: item.description || '', is_active: item.is_active });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      if (editItem) {
        await api.patch(`/menu/${editItem.id}`, form);
      } else {
        await api.post('/menu', form);
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar item.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    try {
      await api.patch(`/menu/${item.id}`, { is_active: !item.is_active });
      fetchItems();
    } catch {
      alert('Erro ao alterar status do item.');
    }
  };

  if (loading) return <Spinner />;

  const filtered = catFilter === 'all' ? items : items.filter(i => i.category === catFilter);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>🍽️ Cardápio</h2>
          <p>{items.filter(i => i.is_active).length} itens ativos · {items.filter(i => !i.is_active).length} inativos</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreate} id="btn-add-menu-item">+ Novo Item</button>
        )}
      </div>

      {/* Filtro por categoria */}
      <div className="flex gap-2 flex-wrap" style={{ marginBottom: '20px' }}>
        <button className={`btn btn-sm ${catFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCatFilter('all')} id="filter-all-menu">Todos</button>
        {categories.map(c => (
          <button key={c.key} className={`btn btn-sm ${catFilter === c.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCatFilter(c.key)} id={`filter-${c.key}`}>
            {c.label}
          </button>
        ))}
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      {filtered.length === 0 ? (
        <EmptyState icon="🍽️" title="Nenhum item encontrado" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Status</th>
                {isAdmin && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.5 }} id={`menu-item-${item.id}`}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.description}</div>}
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      {categories.find(c => c.key === item.category)?.label || item.category}
                    </span>
                  </td>
                  <td style={{ fontWeight: '700' }}>R$ {Number(item.price).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${item.is_active ? 'badge-pronto' : 'badge-encerrado'}`}>
                      {item.is_active ? '✓ Ativo' : '✕ Inativo'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} id={`btn-edit-menu-${item.id}`}>✏️</button>
                        <button
                          className={`btn btn-sm ${item.is_active ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => toggleActive(item)}
                          id={`btn-toggle-menu-${item.id}`}
                        >
                          {item.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          title={editItem ? `Editar: ${editItem.name}` : 'Novo Item do Cardápio'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} id="btn-cancel-menu">Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-menu">
                {saving ? 'Salvando...' : editItem ? 'Salvar Edição' : 'Criar Item'}
              </button>
            </>
          }
        >
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="menu-name">Nome <span className="form-required">*</span></label>
            <input id="menu-name" className="form-input" placeholder="Nome do item" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-grid form-grid-2" style={{ marginBottom: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="menu-cat">Categoria <span className="form-required">*</span></label>
              <select id="menu-cat" className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="menu-price">Preço (R$) <span className="form-required">*</span></label>
              <input id="menu-price" type="number" step="0.01" min="0" className="form-input" placeholder="0,00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="menu-desc">Descrição</label>
            <textarea id="menu-desc" className="form-textarea" placeholder="Descrição opcional..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="menu-active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <label htmlFor="menu-active" style={{ fontSize: '13px', cursor: 'pointer' }}>Item ativo (disponível para venda)</label>
          </div>
        </Modal>
      )}
    </div>
  );
}
