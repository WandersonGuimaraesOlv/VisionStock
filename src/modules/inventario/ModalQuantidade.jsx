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
    <div className="modal fade show d-block vp-modal-overlay" tabIndex="-1" style={{ zIndex: 1070 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content vp-modal-coleta">
          <div className="modal-header">
            <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
              <i className="bi bi-box-seam text-danger"></i> Confirmar Quantidade Física
            </h5>
            <button type="button" className="btn-close" onClick={aoCancelar}></button>
          </div>
          <div className="modal-body py-3">
            {restantes > 0 && (
              <div className="small text-muted mb-2">Mais {restantes} item(ns) aguardando na fila.</div>
            )}

            {!coleta.itemEncontrado && (
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-question-circle fs-3"></i>
                <strong className="text-dark">Material não consta na base SAP importada (será registrado como Sobra).</strong>
              </div>
            )}

            {coleta.localIncorreto && (
              <div className="alert alert-warning border-warning d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-exclamation-triangle-fill fs-3 text-warning"></i>
                <div>
                  <strong className="d-block text-dark">Alerta: Local Divergente do SAP!</strong>
                  <small className="text-muted">
                    Cadastrado no SAP em: <strong>Depósito {coleta.deposito_sap} | Endereço {coleta.endereco_sap}</strong>
                  </small>
                </div>
              </div>
            )}

            <div className="p-3 rounded border mb-3" style={{ background: 'var(--vp-surface-alt)' }}>
              <span className="vp-micro-label m-0">Material (SKU)</span>
              <div className="fs-4 fw-bold text-dark vp-mono">{coleta.material}</div>
              <div className="fw-medium text-secondary mt-1">{coleta.texto_breve}</div>
            </div>

            <div className="form-group mb-3">
              <label className="form-label small fw-bold text-secondary mb-1">
                Quantidade física contada
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                className="vp-input vp-input-lg vp-input-destaque vp-qtd-input w-100"
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
          <div className="modal-footer border-0 pb-4 d-flex flex-nowrap gap-2">
            <button className="vp-btn vp-btn-outline vp-btn-lg w-50" onClick={aoCancelar}>
              {restantes > 0 ? 'Pular' : 'Cancelar'}
            </button>
            <button className="vp-btn vp-btn-primary vp-btn-lg w-50 shadow-sm" onClick={confirmar} disabled={salvando}>
              <i className="bi bi-check-lg"></i> Salvar Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalQuantidade;
