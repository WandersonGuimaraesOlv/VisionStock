// src/modules/inventario/ModalQuantidade.jsx — Input numérico pós-leitura (RN-002) com alerta de local (RN-003).
import { useEffect, useRef, useState } from 'react';
import { parseNumero } from '../../shared/lib/numero';

const ModalQuantidade = ({ coleta, restantes, aoConfirmar, aoCancelar }) => {
  const [quantidade, setQuantidade] = useState('1');
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef(null);

  // Cada item da fila monta um modal novo (key) com 1 selecionado, pronto para o operador sobrescrever
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const confirmar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      await aoConfirmar(parseNumero(quantidade));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1070 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border-2 border-danger">
          <div className="modal-header bg-danger text-white">
            <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
              📦 Confirmar Quantidade Física
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={aoCancelar}></button>
          </div>
          <div className="modal-body py-3">
            {restantes > 0 && (
              <div className="small text-muted mb-2">Mais {restantes} item(ns) aguardando na fila.</div>
            )}

            {!coleta.itemEncontrado && (
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                <span className="fs-3">❓</span>
                <strong className="text-dark">Material não consta na base SAP importada (será registrado como Sobra).</strong>
              </div>
            )}

            {coleta.localIncorreto && (
              <div className="alert alert-warning border-warning d-flex align-items-center gap-2 mb-3">
                <span className="fs-3">⚠️</span>
                <div>
                  <strong className="d-block text-dark">Alerta: Local Divergente do SAP!</strong>
                  <small className="text-muted">
                    Cadastrado no SAP em: <strong>Depósito {coleta.deposito_sap} | Endereço {coleta.endereco_sap}</strong>
                  </small>
                </div>
              </div>
            )}

            <div className="p-3 bg-light rounded border mb-3">
              <div className="small text-uppercase text-secondary fw-bold">Material (SKU)</div>
              <div className="fs-4 fw-bold text-dark font-monospace">{coleta.material}</div>
              <div className="fw-medium text-secondary mt-1">{coleta.texto_breve}</div>
            </div>

            <div className="form-group mb-3">
              <label className="form-label fw-bold text-dark fs-6">
                Quantidade Física Contada:
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                className="form-control form-control-lg text-center fw-bold fs-3 border-danger"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmar();
                  }
                }}
              />
            </div>
          </div>
          <div className="modal-footer bg-light">
            <button className="btn btn-outline-secondary w-48" onClick={aoCancelar}>
              {restantes > 0 ? 'Pular' : 'Cancelar'}
            </button>
            <button className="btn btn-danger fw-bold fs-5 w-48 py-2" onClick={confirmar} disabled={salvando}>
              ✓ Salvar Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalQuantidade;
