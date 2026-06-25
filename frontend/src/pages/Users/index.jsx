import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';
import Modal from '../../components/common/Modal';

const roleLabels = { admin: '👑 Admin', atendente: '👤 Atendente', cozinha: '👨‍🍳 Cozinha' };
const EMPTY_FORM = { name: '', email: '', password: '', role: 'atendente' };

export default function UsersPage() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const { user: me } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
      setError(null);
    } catch {
      setError('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => { setEditUser(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit   = (u) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    if (!editUser && !form.password.trim()) { alert('Senha obrigatória para novo usuário.'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, email: form.email, role: form.role };
      if (form.password.trim()) payload.password = form.password;

      if (editUser) {
        await api.patch(`/users/${editUser.id}`, payload);
      } else {
        await api.post('/users', { ...payload, password: form.password });
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Desativar ${u.name}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao desativar usuário.');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>👥 Usuários</h2>
          <p>{users.filter(u => u.is_active).length} ativo(s)</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="btn-add-user">+ Novo Usuário</button>
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      {users.length === 0 ? (
        <EmptyState icon="👥" title="Nenhum usuário cadastrado" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }} id={`user-row-${u.id}`}>
                  <td>
                    <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '30px', height: '30px', borderRadius: '50%',
                        background: 'var(--primary-dim)', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700',
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      {u.name}
                      {u.id === me?.id && <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700' }}>VOCÊ</span>}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{u.email}</td>
                  <td>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-pronto' : 'badge-encerrado'}`}>
                      {u.is_active ? '✓ Ativo' : '✕ Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} id={`btn-edit-user-${u.id}`}>✏️</button>
                      {u.id !== me?.id && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)} id={`btn-deactivate-user-${u.id}`}>
                          Desativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          title={editUser ? `Editar: ${editUser.name}` : 'Novo Usuário'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} id="btn-cancel-user">Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-user">
                {saving ? 'Salvando...' : editUser ? 'Salvar Edição' : 'Criar Usuário'}
              </button>
            </>
          }
        >
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="user-name">Nome completo <span className="form-required">*</span></label>
            <input id="user-name" className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="user-email">Email <span className="form-required">*</span></label>
            <input id="user-email" type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="user-password">
              Senha {editUser ? '(deixe em branco para não alterar)' : <span className="form-required">*</span>}
            </label>
            <input id="user-password" type="password" className="form-input" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="user-role">Perfil <span className="form-required">*</span></label>
            <select id="user-role" className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="atendente">👤 Atendente</option>
              <option value="cozinha">👨‍🍳 Cozinha</option>
              <option value="admin">👑 Administrador</option>
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}
