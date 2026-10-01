// src/modules/sync/useSyncManager.js
// Hook de Sincronização Offline-First (RN-005).
// Monitora a conectividade de rede e envia em lotes as leituras pendentes do IndexedDB para o Supabase.
import { useState, useEffect, useCallback, useRef } from 'react';
import db from '../../shared/lib/db';
import { supabase } from '../../shared/lib/supabase';
import { config } from '../../app/config';

const TAMANHO_LOTE = 500;
const INTERVALO_RETENTATIVA_MS = 60_000;

// Campos internos do IndexedDB que não existem na tabela do Supabase
export const montarPayload = (leitura) => {
  const { id, _status, _criado_em: _ignorado, ...dado } = leitura;
  return { ...dado, id_local: String(id) };
};

/**
 * useSyncManager
 *
 * @returns {object} { isOnline, pendingCount, syncNow, ultimoErro, servidorConfigurado }
 *   - isOnline: boolean — true se o navegador detecta conexão de rede
 *   - pendingCount: number — número de leituras na fila aguardando sincronização
 *   - syncNow: async function — dispara uma sincronização imediata (chamada após cada bipagem)
 *   - ultimoErro: string | null — mensagem do último envio que falhou
 *   - servidorConfigurado: boolean — false quando o build não tem as chaves do Supabase
 */
export function useSyncManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [ultimoErro, setUltimoErro] = useState(null);
  // Ref para evitar sincronizações simultâneas
  const isSyncing = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await db.leituras_pendentes.where('_status').equals('pendente').count();
    setPendingCount(count);
    return count;
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing.current || !navigator.onLine || !supabase) {
      await refreshPendingCount();
      return;
    }

    isSyncing.current = true;
    try {
      // Envia em lotes; para no primeiro erro e tenta de novo na próxima rodada
      for (;;) {
        const pendentes = await db.leituras_pendentes
          .where('_status').equals('pendente')
          .limit(TAMANHO_LOTE)
          .toArray();
        if (pendentes.length === 0) break;

        // upsert por id_local: se a resposta de um envio anterior se perdeu, não duplica a contagem
        const { error } = await supabase
          .from(config.tabelaLeituras)
          .upsert(pendentes.map(montarPayload), { onConflict: 'id_local', ignoreDuplicates: true });

        if (error) {
          console.error('[SyncManager] Erro ao sincronizar com Supabase:', error);
          setUltimoErro(error.message || 'Falha ao enviar leituras.');
          break;
        }

        await db.leituras_pendentes
          .where('id').anyOf(pendentes.map(p => p.id))
          .modify({ _status: 'sincronizado' });
        setUltimoErro(null);
        console.log(`[SyncManager] ${pendentes.length} leitura(s) sincronizada(s) com sucesso.`);
      }
    } catch (err) {
      console.error('[SyncManager] Erro inesperado na sincronização:', err);
      setUltimoErro(err.message || 'Erro inesperado na sincronização.');
    } finally {
      isSyncing.current = false;
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncNow(); };
    const handleOffline = () => { setIsOnline(false); refreshPendingCount(); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Retenta periodicamente: no galpão o Wi-Fi pode "voltar" sem disparar o evento online
    const intervalo = setInterval(() => { if (navigator.onLine) syncNow(); }, INTERVALO_RETENTATIVA_MS);

    refreshPendingCount();
    if (navigator.onLine) syncNow();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalo);
    };
  }, [syncNow, refreshPendingCount]);

  return { isOnline, pendingCount, syncNow, ultimoErro, servidorConfigurado: !!supabase };
}
