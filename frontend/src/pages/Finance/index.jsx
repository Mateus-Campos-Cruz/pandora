import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { Spinner, Alert } from '../../components/common/UI';

export default function FinancePage() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [closing, setClosing] = useState(false);

  const fetchClosingData = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const res = await api.get(`/finance/closing?date=${date}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar dados financeiros.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchClosingData();
  }, [fetchClosingData]);

  const handleCloseRegister = async () => {
    if (!data || data.alreadyClosed) return;
    if (!window.confirm(`Tem certeza que deseja fechar o caixa do dia ${date}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    setClosing(true);
    try {
      await api.post('/finance/closing', {
        date,
        total_dinheiro: data.agregado.total_dinheiro,
        total_pix: data.agregado.total_pix,
        total_debito: data.agregado.total_debito,
        total_credito: data.agregado.total_credito,
        total_geral: data.agregado.total_geral,
      });
      fetchClosingData();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao fechar caixa.');
    } finally {
      setClosing(false);
    }
  };

  const currentData = data?.alreadyClosed ? data.fechamento : data?.agregado;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>💰 Fechamento de Caixa</h2>
          <p>Resumo financeiro e encerramento do dia</p>
        </div>
        <div className="flex gap-4 items-center flex-wrap">
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: '150px' }}
          />
        </div>
      </div>

      {error && <Alert type="danger">{error}</Alert>}
      
      {loading && !data && <Spinner />}

      {!loading && currentData && (
        <>
          {data.alreadyClosed && (
            <div className="alert alert-success" style={{ marginBottom: '20px' }}>
              ✅ O caixa deste dia já foi fechado e consolidado.
            </div>
          )}

          <div className="grid grid-3" style={{ marginBottom: '24px' }}>
            <div className="card">
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 'bold' }}>TOTAL GERAL</div>
              <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: 'var(--success)' }}>
                R$ {Number(currentData.total_geral || 0).toFixed(2)}
              </div>
            </div>
            
            {!data.alreadyClosed && (
              <>
                <div className="card">
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 'bold' }}>TOTAL DE PEDIDOS</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px' }}>
                    {currentData.total_pedidos || 0}
                  </div>
                </div>
                <div className="card">
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 'bold' }}>TICKET MÉDIO</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px' }}>
                    R$ {Number(currentData.ticket_medio || 0).toFixed(2)}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-2" style={{ marginBottom: '24px' }}>
            <div className="card">
              <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>Por Forma de Pagamento</h3>
              
              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                <span className="font-semibold text-[15px]">💵 Dinheiro</span>
                <span className="font-bold">R$ {Number(currentData.total_dinheiro || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                <span className="font-semibold text-[15px]">⚡ Pix</span>
                <span className="font-bold">R$ {Number(currentData.total_pix || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                <span className="font-semibold text-[15px]">💳 Débito</span>
                <span className="font-bold">R$ {Number(currentData.total_debito || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-semibold text-[15px]">💳 Crédito</span>
                <span className="font-bold">R$ {Number(currentData.total_credito || 0).toFixed(2)}</span>
              </div>
            </div>

            {!data.alreadyClosed && (
              <div className="card">
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>Por Canal (Estimativa Diária)</h3>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="font-semibold text-[15px]">🪑 Salão</span>
                  <span className="font-bold">R$ {Number(currentData.total_salao || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-semibold text-[15px]">🛵 Delivery</span>
                  <span className="font-bold">R$ {Number(currentData.total_delivery || 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {!data.alreadyClosed && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleCloseRegister}
                disabled={closing}
              >
                {closing ? 'Fechando Caixa...' : 'Bloquear e Fechar Caixa do Dia'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
