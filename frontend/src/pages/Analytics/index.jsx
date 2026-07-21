import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import api from '../../services/api';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';
import './Analytics.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { period };
      if (period === 'custom') {
        if (!customStart || !customEnd) {
          setLoading(false);
          return; // Esperando datas válidas
        }
        params.start = customStart;
        params.end = customEnd;
      }
      const response = await api.get('/analytics/dashboard', { params });
      setData(response.data);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados do painel analítico.');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleExportCSV = () => {
    if (!data) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Top Itens
    csvContent += "Top 10 Itens Mais Pedidos\nItem,Quantidade\n";
    data.topItems.forEach(row => {
      csvContent += `"${row.nome}",${row.total_vendido}\n`;
    });
    csvContent += "\n";

    // Taxa de Cancelamento
    csvContent += "Taxa de Cancelamento por Atendente\nAtendente,Total Itens,Cancelados,Taxa (%)\n";
    data.cancelRate.forEach(row => {
      csvContent += `"${row.atendente}",${row.total_itens},${row.itens_cancelados},${Number(row.taxa_cancelamento).toFixed(2)}\n`;
    });
    csvContent += "\n";

    // Receita por Pagamento
    csvContent += "Faturamento por Forma de Pagamento\nData,Forma,Faturamento\n";
    data.revenueByMethod.forEach(row => {
      const dateOnly = new Date(row.data_pagamento).toLocaleDateString('pt-BR');
      csvContent += `"${dateOnly}","${row.forma_pagamento}",${row.faturamento}\n`;
    });
    csvContent += "\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div>
          <h2>Desempenho Operacional 📊</h2>
          <p>Acompanhe os principais indicadores do restaurante</p>
        </div>
        <div className="filters-group">
          <button className={`filter-btn ${period === 'hoje' ? 'active' : ''}`} onClick={() => setPeriod('hoje')}>Hoje</button>
          <button className={`filter-btn ${period === '7d' ? 'active' : ''}`} onClick={() => setPeriod('7d')}>7 Dias</button>
          <button className={`filter-btn ${period === '30d' ? 'active' : ''}`} onClick={() => setPeriod('30d')}>30 Dias</button>
          <button className={`filter-btn ${period === 'custom' ? 'active' : ''}`} onClick={() => setPeriod('custom')}>Personalizado</button>
          
          {period === 'custom' && (
            <div className="custom-date-filter">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span>até</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}

          <button className="btn btn-secondary export-btn" onClick={handleExportCSV} disabled={!data || loading}>
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      {loading ? (
        <Spinner />
      ) : !data ? (
        <EmptyState icon="📊" title="Nenhum dado" description="Selecione um período para visualizar as métricas." />
      ) : (
        <>
          <div className="kpi-cards">
            <div className="kpi-card">
              <span className="kpi-label">Ticket Médio</span>
              <span className="kpi-value">{formatCurrency(data.averageTicket)}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Total Faturado</span>
              <span className="kpi-value">
                {formatCurrency(data.salesComparison.reduce((acc, curr) => acc + Number(curr.faturamento), 0))}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Volume de Pedidos</span>
              <span className="kpi-value">
                {data.salesComparison.reduce((acc, curr) => acc + Number(curr.total_pedidos), 0)}
              </span>
            </div>
          </div>

          <div className="analytics-grid">
            {/* Top 10 Itens Mais Pedidos */}
            <div className="analytics-card">
              <h3>🏆 Top 10 Itens Mais Pedidos</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topItems} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Bar dataKey="total_vendido" fill="#3b82f6" name="Qtd Vendida" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparativo Volume de Pedidos (Salão x Delivery) */}
            <div className="analytics-card">
              <h3>📦 Volume (Salão vs Delivery)</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.salesComparison}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="total_pedidos"
                      nameKey="tipo"
                    >
                      {data.salesComparison.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tempo de preparo por categoria */}
            <div className="analytics-card">
              <h3>⏱️ Tempo Médio de Preparo</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.prepTime} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoria" />
                    <YAxis label={{ value: 'Minutos', angle: -90, position: 'insideLeft' }} />
                    <RechartsTooltip formatter={(value) => `${Number(value).toFixed(1)} min`} />
                    <Bar dataKey="media_preparo_minutos" fill="#f59e0b" name="Média (Min)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Faturamento por Forma de Pagamento */}
            <div className="analytics-card">
              <h3>💳 Faturamento por Pagamento</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.revenueByMethod} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="forma_pagamento" />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="faturamento" fill="#10b981" name="Faturamento" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Taxa de cancelamento por atendente (Tabela) */}
            <div className="analytics-card" style={{ gridColumn: '1 / -1' }}>
              <h3>⚠️ Taxa de Cancelamento por Atendente</h3>
              <div className="table-container">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Atendente</th>
                      <th>Total Itens (Abertos)</th>
                      <th>Itens Cancelados</th>
                      <th>Taxa de Cancelamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cancelRate.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center' }}>Sem dados no período</td>
                      </tr>
                    ) : (
                      data.cancelRate.map((row, i) => (
                        <tr key={i}>
                          <td>{row.atendente}</td>
                          <td>{row.total_itens}</td>
                          <td>{row.itens_cancelados}</td>
                          <td style={{ color: row.taxa_cancelamento > 5 ? 'var(--danger)' : 'inherit' }}>
                            {Number(row.taxa_cancelamento).toFixed(2)}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
