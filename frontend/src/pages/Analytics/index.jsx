import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import api from '../../services/api';
import { Spinner, Alert, EmptyState } from '../../components/common/UI';
import './Analytics.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

/* Trunca labels longas no eixo Y para não estouar o espaço */
const truncate = (str, max = 14) =>
  str && str.length > max ? str.substring(0, max) + '…' : str;

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── Mede a largura real do container para dimensionar os gráficos ── */
  const gridRef = useRef(null);
  const [cardWidth, setCardWidth] = useState(340);

  useEffect(() => {
    const measure = () => {
      if (gridRef.current) {
        // Primeiro filho = primeiro analytics-card
        const card = gridRef.current.querySelector('.analytics-card');
        if (card) {
          const style = window.getComputedStyle(card);
          const paddingH =
            parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
          setCardWidth(card.clientWidth - paddingH);
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [data]); // re-mede quando dados chegam

  const isMobile = cardWidth < 400;
  const chartH   = isMobile ? 200 : 300;
  const yAxisW   = isMobile ? 70  : 120;

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { period };
      if (period === 'custom') {
        if (!customStart || !customEnd) { setLoading(false); return; }
        params.start = customStart;
        params.end   = customEnd;
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

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleExportCSV = () => {
    if (!data) return;
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Top 10 Itens Mais Pedidos\nItem,Quantidade\n';
    data.topItems.forEach(r => { csv += `"${r.nome}",${r.total_vendido}\n`; });
    csv += '\nTaxa de Cancelamento\nAtendente,Total,Cancelados,Taxa(%)\n';
    data.cancelRate.forEach(r => {
      csv += `"${r.atendente}",${r.total_itens},${r.itens_cancelados},${Number(r.taxa_cancelamento).toFixed(2)}\n`;
    });
    csv += '\nFaturamento por Pagamento\nData,Forma,Faturamento\n';
    data.revenueByMethod.forEach(r => {
      csv += `"${new Date(r.data_pagamento).toLocaleDateString('pt-BR')}","${r.forma_pagamento}",${r.faturamento}\n`;
    });
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `analytics_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = v =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  /* ── Tick customizado que trunca nomes longos ── */
  const CustomYTick = ({ x, y, payload }) => (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={isMobile ? 9 : 12} fill="#666">
      {truncate(payload.value, isMobile ? 12 : 20)}
    </text>
  );

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="analytics-header">
        <div>
          <h2>Desempenho Operacional 📊</h2>
          <p>Acompanhe os principais indicadores do restaurante</p>
        </div>
        <div className="filters-group">
          {['hoje', '7d', '30d'].map(p => (
            <button key={p}
              className={`filter-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}>
              {p === 'hoje' ? 'Hoje' : p === '7d' ? '7 Dias' : '30 Dias'}
            </button>
          ))}
          <button className={`filter-btn ${period === 'custom' ? 'active' : ''}`}
            onClick={() => setPeriod('custom')}>
            Personalizado
          </button>
          {period === 'custom' && (
            <div className="custom-date-filter">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span>até</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          <button className="btn btn-secondary export-btn"
            onClick={handleExportCSV} disabled={!data || loading}>
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      {loading ? <Spinner /> : !data ? (
        <EmptyState icon="📊" title="Nenhum dado"
          description="Selecione um período para visualizar as métricas." />
      ) : (
        <>
          {/* KPIs */}
          <div className="kpi-cards">
            <div className="kpi-card">
              <span className="kpi-label">Ticket Médio</span>
              <span className="kpi-value">{formatCurrency(data.averageTicket)}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Total Faturado</span>
              <span className="kpi-value">
                {formatCurrency(data.salesComparison.reduce((a, c) => a + Number(c.faturamento), 0))}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Volume de Pedidos</span>
              <span className="kpi-value">
                {data.salesComparison.reduce((a, c) => a + Number(c.total_pedidos), 0)}
              </span>
            </div>
          </div>

          {/* Grid de gráficos */}
          <div className="analytics-grid" ref={gridRef}>

            {/* Top 10 Itens */}
            <div className="analytics-card">
              <h3>🏆 Top 10 Itens Mais Pedidos</h3>
              <BarChart
                width={cardWidth}
                height={chartH}
                data={data.topItems}
                layout="vertical"
                margin={{ top: 2, right: 10, left: 0, bottom: 2 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis
                  dataKey="nome"
                  type="category"
                  width={yAxisW}
                  tick={<CustomYTick />}
                />
                <RechartsTooltip />
                <Bar dataKey="total_vendido" fill="#3b82f6" name="Qtd Vendida" />
              </BarChart>
            </div>

            {/* Volume Salão vs Delivery */}
            <div className="analytics-card">
              <h3>📦 Volume (Salão vs Delivery)</h3>
              <PieChart width={cardWidth} height={chartH}>
                <Pie
                  data={data.salesComparison}
                  cx="50%"
                  cy="45%"
                  outerRadius={isMobile ? Math.min(cardWidth * 0.28, 70) : 100}
                  dataKey="total_pedidos"
                  nameKey="tipo"
                  label={false}
                >
                  {data.salesComparison.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: isMobile ? 11 : 13 }} />
              </PieChart>
            </div>

            {/* Tempo de Preparo */}
            <div className="analytics-card">
              <h3>⏱️ Tempo Médio de Preparo</h3>
              <BarChart
                width={cardWidth}
                height={chartH}
                data={data.prepTime}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoria" tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 28 : 45} />
                <RechartsTooltip formatter={v => `${Number(v).toFixed(1)} min`} />
                <Bar dataKey="media_preparo_minutos" fill="#f59e0b" name="Média (Min)" />
              </BarChart>
            </div>

            {/* Faturamento por Pagamento */}
            <div className="analytics-card">
              <h3>💳 Faturamento por Pagamento</h3>
              <BarChart
                width={cardWidth}
                height={chartH}
                data={data.revenueByMethod}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="forma_pagamento" tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 28 : 45} />
                <RechartsTooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="faturamento" fill="#10b981" name="Faturamento" />
              </BarChart>
            </div>

            {/* Tabela de cancelamentos */}
            <div className="analytics-card" style={{ gridColumn: '1 / -1' }}>
              <h3>⚠️ Taxa de Cancelamento por Atendente</h3>
              <div className="table-container">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Atendente</th>
                      <th>Total Itens</th>
                      <th>Cancelados</th>
                      <th>Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cancelRate.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center' }}>Sem dados no período</td></tr>
                    ) : data.cancelRate.map((row, i) => (
                      <tr key={i}>
                        <td>{row.atendente}</td>
                        <td>{row.total_itens}</td>
                        <td>{row.itens_cancelados}</td>
                        <td style={{ color: row.taxa_cancelamento > 5 ? 'var(--danger)' : 'inherit' }}>
                          {Number(row.taxa_cancelamento).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
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
