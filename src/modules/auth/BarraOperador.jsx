// src/modules/auth/BarraOperador.jsx — Cartão do operador logado e navegação principal.
import { obterIniciais } from '../../shared/lib/operador';

const BarraOperador = ({ operador, mostrandoConciliacao, aoAlternarTela, aoSair }) => (
  <div className="vp-operator-card mb-4">
    <div className="vp-operator-info">
      <div className="vp-operator-avatar">{obterIniciais(operador.nome)}</div>
      <div>
        <span className="vp-micro-label" style={{ margin: 0 }}>Operador Logado</span>
        <h4 className="vp-operator-name">{operador.nome}</h4>
        <span className="vp-operator-badge"><i className="bi bi-person-badge"></i> {operador.cracha}</span>
      </div>
    </div>
    <div className="vp-operator-actions">
      <button className="vp-btn vp-btn-outline" onClick={aoAlternarTela}>
        {mostrandoConciliacao
          ? <><i className="bi bi-upc-scan"></i> Contagem</>
          : <><i className="bi bi-list-check"></i> Conciliação</>}
      </button>
      <button className="vp-btn vp-btn-ghost-danger" onClick={aoSair}>
        <i className="bi bi-box-arrow-right"></i> Sair
      </button>
    </div>
  </div>
);

export default BarraOperador;
