// src/modules/importacao-sap/ImportacaoSap.jsx — Passo 1: importação da base "ETIQUETAS".
import { useRef, useState } from 'react';
import { parsePlanilhaEtiquetas, lerArquivoTexto } from './parserEtiquetas';

const ImportacaoSap = ({ totalItens, totalLeituras, aoImportar, aoIniciar, aoNovoInventario, abrirAlerta }) => {
  const fileInputRef = useRef(null);
  const [carregando, setCarregando] = useState(false);

  const importar = async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    setCarregando(true);
    try {
      const texto = await lerArquivoTexto(arquivo);
      const { itens, erro, linhasIgnoradas } = parsePlanilhaEtiquetas(texto);
      if (erro) {
        abrirAlerta('Erro no Arquivo', erro);
        return;
      }
      await aoImportar(itens);
      const aviso = linhasIgnoradas > 0 ? ` (${linhasIgnoradas} linhas sem Material foram ignoradas)` : '';
      abrirAlerta('Sucesso', `Planilha ETIQUETAS importada com sucesso! ${itens.length} materiais cadastrados${aviso}.`);
    } catch (err) {
      console.error(err);
      abrirAlerta('Erro', 'Falha ao processar arquivo. Verifique se é um CSV válido.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setCarregando(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold m-0">1. Base de Referência (SAP)</h4>
        <span className="badge bg-secondary">{totalItens} materiais carregados</span>
      </div>

      <div className="p-3 bg-light rounded border mb-3">
        <p className="small text-muted mb-2">
          Importe a planilha <strong>"ETIQUETAS"</strong> (.CSV) exportada do SAP ERP com as colunas:
          <code>Material</code>, <code>Texto breve material</code>, <code>Endereço</code>, <code>Depósito</code> e <code>Quantidade SAP</code>.
        </p>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          ref={fileInputRef}
          className="form-control"
          onChange={importar}
          disabled={carregando}
        />
        {carregando && <small className="text-muted d-block mt-2">Processando planilha...</small>}
      </div>

      <button className="btn btn-danger btn-lg w-100 fw-bold shadow-sm py-3" onClick={aoIniciar}>
        🚀 Iniciar Contagem Física
      </button>

      {(totalItens > 0 || totalLeituras > 0) && (
        <button className="btn btn-outline-secondary w-100 mt-2" onClick={aoNovoInventario}>
          Encerrar inventário e começar um novo
        </button>
      )}
    </div>
  );
};

export default ImportacaoSap;
