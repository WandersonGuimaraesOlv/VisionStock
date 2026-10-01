// src/modules/inventario/UltimasLeituras.jsx — Resumo das últimas contagens registradas.
const UltimasLeituras = ({ leituras, limite = 5 }) => (
  <div className="mt-4">
    <h6 className="fw-bold text-muted text-uppercase mb-2" style={{ fontSize: '0.75rem' }}>
      Últimas Contagens Registradas ({leituras.length})
    </h6>
    <div className="list-group">
      {leituras.slice(0, limite).map(l => (
        <div key={l.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
          <div>
            <strong className="font-monospace text-dark d-block">{l.material}</strong>
            <small className="text-muted d-block">{l.texto_breve}</small>
          </div>
          <div className="text-end">
            <span className="badge bg-primary fs-6">Qtd: {l.quantidade_fisica}</span>
            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>
              {l.endereco_lido}
            </small>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default UltimasLeituras;
