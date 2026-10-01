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
    <div className="vp-update-banner">
      <div className="vp-update-banner-content">
        <i className="bi bi-cloud-arrow-down-fill me-2 fs-5 text-warning"></i>
        <span>Nova versão do VisionStock disponível! Deseja aplicar agora?</span>
      </div>
      <div className="vp-update-banner-actions">
        <button className="vp-btn vp-btn-success btn-sm me-1 px-3" onClick={atualizar}>
          <i className="bi bi-arrow-clockwise"></i> Atualizar
        </button>
        <button className="vp-btn vp-btn-ghost-danger btn-sm px-2" onClick={() => setRegistro(null)}>
          Depois
        </button>
      </div>
    </div>
  );
};

export default BannerAtualizacao;
