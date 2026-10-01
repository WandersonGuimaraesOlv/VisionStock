// src/modules/conciliacao/PainelConciliacao.jsx — Painel de conciliação Física vs. SAP.
import { useMemo, useState } from 'react';
import FilterControls from './FilterControls';
import { conciliar, filtrarEOrdenar, calcularEstatisticas, ROTULO_STATUS } from './conciliar';
import { baixarCsvConciliacao } from './exportarCsv';

const ITENS_POR_PAGINA = 50;
const FILTROS_VAZIOS = { material: '', status: '', deposito: '' };

const CLASSE_STATUS = {
  OK: 'bg-success',
  FALTA: 'bg-danger',
  SOBRA: 'bg-warning text-dark',
  LOCAL_INCORRETO: 'bg-info text-dark',
  NAO_ENCONTRADO: 'bg-secondary',
};

const CARDS = [
  { campo: 'totalItens', rotulo: 'Total Itens', classe: 'bg-light', texto: '' },
  { campo: 'totalOk', rotulo: 'OK (Sem Divergência)', classe: 'bg-success bg-opacity-10 border-success', texto: 'text-success' },
  { campo: 'totalFalta', rotulo: 'Divergência Falta', classe: 'bg-danger bg-opacity-10 border-danger', texto: 'text-danger' },
  { campo: 'totalSobra', rotulo: 'Divergência Sobra', classe: 'bg-warning bg-opacity-10 border-warning', texto: 'text-warning' },
  { campo: 'totalLocalIncorreto', rotulo: 'Local Incorreto', classe: 'bg-info bg-opacity-10 border-info', texto: 'text-info' },
  { campo: 'totalNaoEncontrado', rotulo: 'Não Encontrado', classe: 'bg-secondary bg-opacity-10 border-secondary', texto: 'text-secondary' },
];

const PainelConciliacao = ({ itensSap, leituras, abrirAlerta }) => {
  const [filtros, setFiltrosState] = useState(FILTROS_VAZIOS);
  const [ordenacao, setOrdenacao] = useState({ field: 'material', order: 'asc' });
  const [pagina, setPagina] = useState(1);

  const linhas = useMemo(() => conciliar(itensSap, leituras), [itensSap, leituras]);
  const filtradas = useMemo(() => filtrarEOrdenar(linhas, filtros, ordenacao), [linhas, filtros, ordenacao]);
  const stats = useMemo(() => calcularEstatisticas(linhas), [linhas]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaSegura - 1) * ITENS_POR_PAGINA, paginaSegura * ITENS_POR_PAGINA);

  // Qualquer mudança de filtro volta para a primeira página
  const setFiltros = (novos) => { setFiltrosState(novos); setPagina(1); };

  const exportar = () => {
    if (linhas.length === 0) {
      abrirAlerta('Atenção', 'Não há dados de conciliação para exportar.');
      return;
    }
    baixarCsvConciliacao(linhas);
  };

  return (
    <div className="card shadow-sm border-0 p-3 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold m-0">📊 Conciliação de Estoque Física vs. SAP</h4>
        <button className="btn btn-success fw-bold btn-sm d-flex align-items-center gap-1" onClick={exportar}>
          📥 Exportar Relatório CSV
        </button>
      </div>

      <div className="row g-2 mb-3">
        {CARDS.map(c => (
          <div className="col-6 col-md-2" key={c.campo}>
            <div className={`p-2 border rounded text-center ${c.classe}`}>
              <small className={`d-block text-uppercase fw-bold ${c.texto || 'text-muted'}`} style={{ fontSize: '0.65rem' }}>{c.rotulo}</small>
              <strong className={`fs-5 ${c.texto}`}>{stats[c.campo]}</strong>
            </div>
          </div>
        ))}
      </div>

      <FilterControls
        filters={filtros}
        onFilterChange={setFiltros}
        onResetFilters={() => setFiltros(FILTROS_VAZIOS)}
        sortConfig={ordenacao}
        onSortChange={setOrdenacao}
        itemsCount={filtradas.length}
      />

      <div className="table-responsive">
        <table className="table table-hover table-striped border align-middle text-start" style={{ fontSize: '0.85rem' }}>
          <thead className="table-dark">
            <tr>
              <th>Status</th>
              <th>Material (SKU)</th>
              <th>Descrição</th>
              <th>Depósito SAP</th>
              <th>Endereço SAP</th>
              <th>Qtd SAP</th>
              <th>Qtd Física</th>
              <th>Diferença</th>
              <th>Locais Lidos</th>
              <th>Operador</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((item, idx) => (
              <tr key={`${paginaSegura}-${idx}-${item.material}`}>
                <td><span className={`badge ${CLASSE_STATUS[item.status]}`}>{ROTULO_STATUS[item.status]}</span></td>
                <td className="fw-bold font-monospace">{item.material}</td>
                <td>{item.texto_breve}</td>
                <td>{item.deposito_sap}</td>
                <td>{item.endereco_sap}</td>
                <td className="fw-bold">{item.quantidade_sap}</td>
                <td className="fw-bold text-primary">{item.quantidade_fisica}</td>
                <td className={`fw-bold ${item.diferenca < 0 ? 'text-danger' : item.diferenca > 0 ? 'text-warning' : 'text-success'}`}>
                  {item.diferenca > 0 ? `+${item.diferenca}` : item.diferenca}
                </td>
                <td>{item.locais_lidos}</td>
                <td>{item.operador_str}</td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan="10" className="text-center py-4 text-muted">
                  Nenhum registro de conciliação encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="d-flex justify-content-between align-items-center gap-2">
          <button className="btn btn-sm btn-outline-secondary" disabled={paginaSegura <= 1} onClick={() => setPagina(paginaSegura - 1)}>
            ← Anterior
          </button>
          <small className="text-muted">Página {paginaSegura} de {totalPaginas}</small>
          <button className="btn btn-sm btn-outline-secondary" disabled={paginaSegura >= totalPaginas} onClick={() => setPagina(paginaSegura + 1)}>
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
};

export default PainelConciliacao;
