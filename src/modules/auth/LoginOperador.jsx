// src/modules/auth/LoginOperador.jsx — Tela de identificação do operador.
import { useState } from 'react';

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
    <div className="card shadow-sm border-0 my-4 p-4 text-center">
      <h3 className="fw-bold mb-2">Identificação do Operador</h3>
      <p className="text-muted small mb-4">Digite o número do seu crachá ou identificação de almoxarifado para iniciar.</p>

      <div className="form-group mb-3 max-width-xs mx-auto">
        <input
          type="text"
          className="form-control form-control-lg text-center font-monospace"
          placeholder="Número do Crachá..."
          value={cracha}
          onChange={(e) => setCracha(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && entrar()}
        />
      </div>

      <button className="btn btn-danger btn-lg w-100 fw-bold shadow-sm" onClick={entrar} disabled={carregando}>
        {carregando ? 'Validando...' : 'Entrar no Sistema'}
      </button>
    </div>
  );
};

export default LoginOperador;
