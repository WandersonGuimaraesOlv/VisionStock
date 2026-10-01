// src/modules/importacao-sap/parserEtiquetas.js
// Parser puro da planilha SAP "ETIQUETAS" (CSV ; , ou TAB). Sem dependência de React/DOM.
import { limparCodigo } from '../../shared/lib/codigo';
import { parseNumero } from '../../shared/lib/numero';

const normalizarCabecalho = (h) =>
  h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const COLUNAS = {
  material: ['material', 'sku', 'codigo', 'codigomaterial', 'item'],
  descricao: ['textobrevematerial', 'textobreve', 'descricao', 'nomematerial'],
  endereco: ['endereco', 'enderecoraw', 'localizacao', 'posicao', 'gondola', 'prateleira'],
  deposito: ['deposito', 'depositocodigo', 'centro', 'almoxarifado', 'unidade'],
  quantidade: ['quantidadesap', 'qtdsap', 'saldosap', 'quantidade', 'saldo', 'qtd'],
};

const detectarSeparador = (linha) => {
  const contar = (re) => (linha.match(re) || []).length;
  const tabs = contar(/\t/g);
  const pontoVirgula = contar(/;/g);
  const virgulas = contar(/,/g);
  if (tabs > pontoVirgula && tabs > virgulas) return '\t';
  return pontoVirgula >= virgulas ? ';' : ',';
};

export const parseLinhaCSV = (linha, separador) => {
  const resultado = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') { atual += '"'; i++; } else { entreAspas = !entreAspas; }
    } else if (c === separador && !entreAspas) {
      resultado.push(atual); atual = '';
    } else {
      atual += c;
    }
  }
  resultado.push(atual);
  return resultado.map(v => v.trim());
};

/**
 * Converte o texto da planilha em itens SAP.
 * @returns {{ itens: Array, erro?: string, linhasIgnoradas: number }}
 */
export const parsePlanilhaEtiquetas = (texto) => {
  const linhas = String(texto || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (linhas.length === 0) return { itens: [], erro: 'O arquivo CSV selecionado está vazio.', linhasIgnoradas: 0 };

  let idxCabecalho = 0;
  for (let i = 0; i < Math.min(10, linhas.length); i++) {
    const l = linhas[i].toLowerCase();
    if (l.includes('material') || l.includes('sku') || l.includes('código') || l.includes('codigo')) {
      idxCabecalho = i;
      break;
    }
  }

  const separador = detectarSeparador(linhas[idxCabecalho]);
  const cabecalhos = parseLinhaCSV(linhas[idxCabecalho], separador).map(normalizarCabecalho);
  const indice = (termos) => {
    for (const t of termos) {
      const idx = cabecalhos.indexOf(t);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idx = Object.fromEntries(Object.entries(COLUNAS).map(([k, termos]) => [k, indice(termos)]));
  if (idx.material === -1) {
    return { itens: [], erro: 'A planilha precisa conter ao menos a coluna "Material" (ou SKU/Código).', linhasIgnoradas: 0 };
  }

  const valor = (colunas, i, padrao) => (i !== -1 && colunas[i] ? colunas[i] : padrao);
  const itens = [];
  let linhasIgnoradas = 0;

  for (let i = idxCabecalho + 1; i < linhas.length; i++) {
    const colunas = parseLinhaCSV(linhas[i], separador);
    const material = limparCodigo(colunas[idx.material]);
    if (!material) { linhasIgnoradas++; continue; }

    itens.push({
      material,
      texto_breve: valor(colunas, idx.descricao, 'Sem descrição'),
      endereco: valor(colunas, idx.endereco, '-'),
      deposito: valor(colunas, idx.deposito, 'Padrão'),
      quantidade_sap: parseNumero(valor(colunas, idx.quantidade, '0')),
    });
  }

  return { itens, linhasIgnoradas };
};

/**
 * Lê o arquivo como texto detectando a codificação:
 * tenta UTF-8 (exportações novas) e cai para Windows-1252 (padrão do SAP GUI/Excel BR).
 */
export const lerArquivoTexto = async (arquivo) => {
  const buffer = await arquivo.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
};
