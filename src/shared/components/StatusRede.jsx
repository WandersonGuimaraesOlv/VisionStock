// src/shared/components/StatusRede.jsx — Indicador de rede e da fila offline.
const StatusRede = ({ isOnline, pendingCount, ultimoErro, aoSincronizar }) => (
  <div className="d-flex justify-content-between align-items-center mb-3 px-2 gap-2 flex-wrap">
    <span className={`badge ${isOnline ? 'bg-success' : 'bg-danger'} p-2`}>
      {isOnline ? '🌐 Online (Conectado)' : '⚡ Offline (IndexedDB Ativo)'}
    </span>
    {pendingCount > 0 && (
      <button type="button" className="badge bg-warning text-dark p-2 border-0" onClick={aoSincronizar} title={ultimoErro || 'Enviar agora'}>
        🔄 {pendingCount} leituras pendentes de envio{ultimoErro ? ' (falha no último envio)' : ''}
      </button>
    )}
  </div>
);

export default StatusRede;
