// src/modules/inventario/UltimasLeituras.jsx — Resumo das últimas contagens registradas.
const UltimasLeituras = ({ leituras, limite = 5 }) => (
  <div className="mt-4">
    <span className="vp-micro-label mb-2 d-block">Últimas Contagens Registradas ({leituras.length})</span>
    {leituras.slice(0, limite).map(l => (
      <div key={l.id} className="vp-leitura-item">
        <div>
          <strong className="vp-mono d-block text-dark">{l.material}</strong>
          <small className="text-muted d-block">{l.texto_breve}</small>
        </div>
        <div className="text-end">
          <span className="vp-qtd-badge">Qtd: {l.quantidade_fisica}</span>
          <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>{l.endereco_lido}</small>
        </div>
      </div>
    ))}
  </div>
);

export default UltimasLeituras;
