// src/modules/auth/BarraOperador.jsx — Barra com o operador logado e navegação principal.
const BarraOperador = ({ operador, mostrandoConciliacao, aoAlternarTela, aoSair }) => (
  <div className="card border-0 bg-dark text-white p-3 mb-3 d-flex flex-row align-items-center justify-content-between shadow-sm">
    <div>
      <small className="text-secondary d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Operador Logado</small>
      <strong className="fs-6 text-light">{operador.nome} ({operador.cracha})</strong>
    </div>
    <div className="d-flex gap-2">
      <button className="btn btn-outline-light btn-sm" onClick={aoAlternarTela}>
        {mostrandoConciliacao ? '📋 Contagem' : '📊 Painel Conciliação'}
      </button>
      <button className="btn btn-outline-danger btn-sm" onClick={aoSair}>
        Sair
      </button>
    </div>
  </div>
);

export default BarraOperador;
