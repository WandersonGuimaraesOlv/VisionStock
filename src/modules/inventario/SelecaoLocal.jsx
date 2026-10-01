// src/modules/inventario/SelecaoLocal.jsx — Passo 2: depósito e endereço da contagem.
const SelecaoLocal = ({ deposito, endereco, aoMudarDeposito, aoMudarEndereco, aoVoltar, aoConfirmar }) => (
  <div>
    <h4 className="fw-bold mb-3">2. Selecionar Local de Contagem</h4>
    <div className="form-group mb-3">
      <label className="form-label fw-bold">Depósito / Almoxarifado:</label>
      <input
        type="text"
        className="form-control form-control-lg"
        placeholder="Ex: Depósito 1001 / Almoxarifado Central"
        value={deposito}
        onChange={(e) => aoMudarDeposito(e.target.value)}
      />
    </div>
    <div className="form-group mb-3">
      <label className="form-label fw-bold">Endereço / Prateleira / Gôndola (Opcional):</label>
      <input
        type="text"
        className="form-control form-control-lg"
        placeholder="Ex: Corredor A - P12"
        value={endereco}
        onChange={(e) => aoMudarEndereco(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && aoConfirmar()}
      />
    </div>

    <div className="d-flex gap-2">
      <button className="btn btn-outline-secondary w-50" onClick={aoVoltar}>
        Voltar
      </button>
      <button className="btn btn-danger fw-bold w-50 py-3 fs-5" onClick={aoConfirmar}>
        Ir para Bipagem →
      </button>
    </div>
  </div>
);

export default SelecaoLocal;
