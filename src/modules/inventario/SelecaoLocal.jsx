// src/modules/inventario/SelecaoLocal.jsx — Passo 2: depósito e endereço da contagem.
const SelecaoLocal = ({ deposito, endereco, aoMudarDeposito, aoMudarEndereco, aoVoltar, aoConfirmar }) => (
  <div className="vp-card no-hover" style={{ margin: 0 }}>
    <span className="vp-micro-label mb-2 d-block">Endereçamento</span>
    <h3 className="vp-title mb-4">Onde será a contagem?</h3>

    <div className="mb-3">
      <label className="form-label small fw-bold text-secondary mb-1">Depósito / Almoxarifado</label>
      <input
        type="text"
        className="vp-input vp-input-lg w-100"
        placeholder="Ex: Depósito 1001 / Almoxarifado Central"
        value={deposito}
        onChange={(e) => aoMudarDeposito(e.target.value)}
        autoFocus
      />
    </div>
    <div className="mb-4">
      <label className="form-label small fw-bold text-secondary mb-1">Endereço / Prateleira / Gôndola (opcional)</label>
      <input
        type="text"
        className="vp-input vp-input-lg w-100"
        placeholder="Ex: Corredor A - P12"
        value={endereco}
        onChange={(e) => aoMudarEndereco(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && aoConfirmar()}
      />
    </div>

    <div className="row g-2">
      <div className="col-6">
        <button className="vp-btn vp-btn-outline vp-btn-lg w-100" onClick={aoVoltar}>Voltar</button>
      </div>
      <div className="col-6">
        <button className="vp-btn vp-btn-primary vp-btn-lg w-100 shadow-sm" onClick={aoConfirmar}>
          Ir para Bipagem <i className="bi bi-arrow-right"></i>
        </button>
      </div>
    </div>
  </div>
);

export default SelecaoLocal;
