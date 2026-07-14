import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook para gerenciar polling automático.
 * @param {string} url - Rota da API a ser consultada (ex: '/pedidos/atualizacoes')
 * @param {function} onAtualizacao - Callback chamado quando há novas atualizações
 */
export function usePolling(url, onAtualizacao) {
  const [carregando, setCarregando] = useState(false);
  const [semConexao, setSemConexao] = useState(false);
  
  const timestampRef = useRef(null);
  const intervalRef = useRef(null);
  const onAtualizacaoRef = useRef(onAtualizacao);

  // Mantém a referência do callback sempre atualizada sem precisar recriar o intervalo
  useEffect(() => {
    onAtualizacaoRef.current = onAtualizacao;
  }, [onAtualizacao]);

  const fetchDados = useCallback(async () => {
    setCarregando(true);
    try {
      const endpoint = timestampRef.current 
        ? `${url}?desde=${encodeURIComponent(timestampRef.current)}` 
        : url;
        
      const response = await api.get(endpoint);
      setSemConexao(false);
      
      if (response.data.timestamp_servidor) {
        timestampRef.current = response.data.timestamp_servidor;
      }
      
      if (onAtualizacaoRef.current) {
        onAtualizacaoRef.current(response.data);
      }
    } catch (err) {
      console.error('Erro no polling:', err);
      setSemConexao(true);
    } finally {
      setCarregando(false);
    }
  }, [url]);

  useEffect(() => {
    // 1. Fetch imediato na montagem
    fetchDados();

    // 2. Lê intervalo do env ou usa 10000ms padrão
    const intervalMs = parseInt(import.meta.env.VITE_POLLING_INTERVAL, 10) || 10000;

    // 3. Configura o polling
    intervalRef.current = setInterval(() => {
      fetchDados();
    }, intervalMs);

    // 4. Cleanup na desmontagem (evita memory leaks)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchDados]);

  return { carregando, semConexao };
}
