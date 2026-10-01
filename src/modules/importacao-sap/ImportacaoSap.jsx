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
    <>
      <div className="vp-card vp-sap-card no-hover mb-4">
        <div className="vp-sap-info">
          <div className="vp-sap-icon"><i className="bi bi-filetype-csv"></i></div>
          <div>
            <h3 className="vp-title">Base SAP "ETIQUETAS"</h3>
            <p className="vp-subtitle">
              {totalItens > 0 ? `${totalItens} materiais carregados` : 'Material, Texto breve, Endereço, Depósito e Quantidade SAP'}
            </p>
          </div>
        </div>
        <div className="w-100 w-sm-auto">
          <input type="file" accept=".csv,.txt,text/csv" className="d-none" ref={fileInputRef} onChange={importar} id="csvUpload" disabled={carregando} />
          <label htmlFor="csvUpload" className={`vp-btn vp-btn-outline w-100 d-flex justify-content-center align-items-center gap-2 ${carregando ? 'disabled' : ''}`}>
            {carregando ? <span className="spinner-border spinner-border-sm" role="status"></span> : <i className="bi bi-cloud-upload"></i>}
            {carregando ? 'Lendo...' : 'Importar Planilha'}
          </label>
        </div>
      </div>

      <div className="vp-card no-hover text-center mb-4" style={{ margin: 0 }}>
        <span className="vp-micro-label mb-2 d-block">Contagem física</span>
        <h2 className="vp-title mb-4">Pronto para a Contagem</h2>
        <button className="vp-btn vp-btn-primary vp-btn-lg w-100 shadow-sm" onClick={aoIniciar}>
          <i className="bi bi-upc-scan"></i> Iniciar Contagem Física
        </button>
        {(totalItens > 0 || totalLeituras > 0) && (
          <button className="vp-btn vp-btn-ghost-danger w-100 mt-2" onClick={aoNovoInventario}>
            Encerrar inventário e começar um novo
          </button>
        )}
      </div>
    </>
  );
};

export default ImportacaoSap;
