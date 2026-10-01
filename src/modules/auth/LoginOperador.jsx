// src/modules/auth/LoginOperador.jsx — Tela de identificação do operador (padrão visual Videplast).
import { useState } from 'react';
import logoVideplast from '../../assets/videplast-brand.png';

const LoginOperador = ({ aoEntrar, abrirAlerta }) => {
  const [cracha, setCracha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const entrar = async () => {
    if (!cracha.trim()) {
      abrirAlerta('Atenção', 'Insira o número do seu crachá ou identificação.');
      return;
    }
    setCarregando(true);
    try {
      await aoEntrar(cracha);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="vp-login-wrapper">
      <div className="card w-100 shadow-lg border-0 vp-login-card">
        <div className="vp-login-faixa"></div>
        <div className="card-body p-4 p-sm-5 pt-4">
          <div className="text-center mb-4 pb-2">
            <img src={logoVideplast} alt="Videplast" className="img-fluid mb-4" style={{ maxHeight: '55px', objectFit: 'contain' }} />
            <h4 className="fw-bold mb-2" style={{ color: 'var(--vp-dark)', fontSize: '1.25rem' }}>Acesso ao Sistema</h4>
            <span className="badge bg-light text-secondary border px-3 py-2 rounded-pill fw-semibold shadow-sm mt-2" style={{ letterSpacing: '0.3px', fontSize: '0.8rem' }}>
              <i className="bi bi-boxes me-1 text-danger"></i> Inventário de Almoxarifado
            </span>
          </div>

          <label className="vp-login-label" htmlFor="cracha">Credencial do Operador</label>
          <div className="vp-login-campo mb-4">
            <i className="bi bi-person-badge fs-5"></i>
            <input
              id="cracha"
              type="text"
              inputMode="numeric"
              placeholder="Nº do Crachá"
              value={cracha}
              onChange={(e) => setCracha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !carregando && entrar()}
              disabled={carregando}
              autoFocus
            />
          </div>

          <button className="vp-btn vp-btn-primary vp-btn-lg w-100 shadow-sm" onClick={entrar} disabled={carregando || !cracha.trim()}>
            {carregando
              ? <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validando...</>
              : <>Entrar no Sistema <i className="bi bi-arrow-right-short fs-4"></i></>}
          </button>

          <div className="text-center mt-4 pt-3 border-top">
            <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>
              <i className="bi bi-shield-check me-1"></i> Ambiente Seguro
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginOperador;
