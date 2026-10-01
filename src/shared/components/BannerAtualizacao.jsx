// src/shared/components/BannerAtualizacao.jsx — Aviso de nova versão do PWA (Service Worker).
import { useEffect, useState } from 'react';

const BannerAtualizacao = () => {
  const [registro, setRegistro] = useState(null);

  useEffect(() => {
    const lidar = (event) => setRegistro(event.detail);
    window.addEventListener('pwa-update-available', lidar);
    return () => window.removeEventListener('pwa-update-available', lidar);
  }, []);

  if (!registro) return null;

  const atualizar = () => {
    registro.waiting?.postMessage({ type: 'SKIP_WAITING' });
    setRegistro(null);
  };

  return (
    <div className="alert alert-warning d-flex justify-content-between align-items-center mb-3 shadow-sm" role="alert">
      <div>
        <strong>Nova versão disponível!</strong> Atualize a aplicação para obter as últimas melhorias.
      </div>
      <button className="btn btn-sm btn-dark" onClick={atualizar}>
        Atualizar Agora
      </button>
    </div>
  );
};

export default BannerAtualizacao;
