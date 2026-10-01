// src/shared/components/StatusRede.jsx — Indicador de rede e da fila offline.
const StatusRede = ({ isOnline, servidorConfigurado, pendingCount, ultimoErro, aoSincronizar }) => {
  if (!isOnline || !servidorConfigurado) {
    return (
      <span className="badge vp-badge-offline" title={servidorConfigurado ? 'Sem conexão — leituras salvas no aparelho' : 'Servidor (Supabase) não configurado — leituras salvas no aparelho'}>
        <span className="vp-badge-dot vp-badge-dot-offline"></span>
        {servidorConfigurado ? 'Offline' : 'Sem servidor'}{pendingCount > 0 ? ` — ${pendingCount} na fila` : ''}
      </span>
    );
  }
  if (pendingCount > 0) {
    return (
      <button type="button" className="badge vp-badge-syncing border-0" onClick={aoSincronizar} title={ultimoErro || 'Enviar agora'}>
        <span className="vp-badge-dot vp-badge-dot-syncing"></span>
        {ultimoErro ? `Falha no envio — ${pendingCount} na fila` : `Sincronizando ${pendingCount}...`}
      </button>
    );
  }
  return (
    <span className="badge vp-badge-online" title="Online — todas as leituras sincronizadas">
      <span className="vp-badge-dot vp-badge-dot-online"></span>
      Online
    </span>
  );
};

export default StatusRede;
