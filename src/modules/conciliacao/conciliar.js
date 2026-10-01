// src/modules/conciliacao/conciliar.js — Motor de Conciliação Física vs. SAP (RN-004).
// Funções puras: recebem a base SAP e as leituras e devolvem as linhas conciliadas.
import { mesmoLocal, normalizarLocal } from '../../shared/lib/local';

export const STATUS = {
  OK: 'OK',
  FALTA: 'FALTA',
  SOBRA: 'SOBRA',
  LOCAL_INCORRETO: 'LOCAL_INCORRETO',
  NAO_ENCONTRADO: 'NAO_ENCONTRADO',
};

export const ROTULO_STATUS = {
  OK: 'OK',
  FALTA: 'Divergência (Falta)',
  SOBRA: 'Divergência (Sobra)',
  LOCAL_INCORRETO: 'Local Incorreto',
  NAO_ENCONTRADO: 'Não Encontrado',
};

const novaLinha = (base) => ({
  quantidade_fisica: 0,
  teveLocalIncorreto: false,
  locaisLidos: new Set(),
  operadores: new Set(),
  ...base,
});

/**
 * Escolhe a linha SAP que recebe a leitura quando o mesmo Material existe em vários locais:
 * 1º mesmo depósito e endereço, 2º mesmo depósito, 3º a primeira linha cadastrada.
 */
const escolherLinhaSap = (candidatas, leitura) =>
  candidatas.find(l => mesmoLocal(l.sap, leitura.deposito_lido, leitura.endereco_lido))
  || candidatas.find(l => mesmoLocal(l.sap, leitura.deposito_lido, ''))
  || candidatas[0];

const calcularStatus = (linha) => {
  const diferenca = linha.quantidade_fisica - linha.quantidade_sap;
  if (linha.quantidade_sap > 0 && linha.quantidade_fisica === 0) return STATUS.NAO_ENCONTRADO;
  if (linha.teveLocalIncorreto) return STATUS.LOCAL_INCORRETO;
  if (diferenca < 0) return STATUS.FALTA;
  if (diferenca > 0) return STATUS.SOBRA;
  return STATUS.OK;
};

const arredondar = (n) => Math.round(n * 1000) / 1000;

export const conciliar = (itensSap, leituras) => {
  const linhas = [];
  const porMaterial = new Map();

  // 1. Uma linha por item da base SAP "ETIQUETAS"
  itensSap.forEach(item => {
    const linha = novaLinha({
      sap: item,
      material: item.material,
      texto_breve: item.texto_breve,
      deposito_sap: item.deposito,
      endereco_sap: item.endereco,
      quantidade_sap: item.quantidade_sap,
    });
    linhas.push(linha);
    if (!porMaterial.has(item.material)) porMaterial.set(item.material, []);
    porMaterial.get(item.material).push(linha);
  });

  // 2. Soma as leituras físicas
  const extras = new Map();
  leituras.forEach(leitura => {
    const candidatas = porMaterial.get(leitura.material);
    let linha;
    if (candidatas) {
      linha = escolherLinhaSap(candidatas, leitura);
    } else {
      // Sobra: item não previsto na base importada
      const chave = `${leitura.material}|${normalizarLocal(leitura.deposito_lido)}|${normalizarLocal(leitura.endereco_lido)}`;
      linha = extras.get(chave);
      if (!linha) {
        linha = novaLinha({
          material: leitura.material,
          texto_breve: leitura.texto_breve || 'Item Não Previsto no SAP',
          deposito_sap: '-',
          endereco_sap: '-',
          quantidade_sap: 0,
        });
        extras.set(chave, linha);
        linhas.push(linha);
      }
    }

    linha.quantidade_fisica = arredondar(linha.quantidade_fisica + (Number(leitura.quantidade_fisica) || 0));
    linha.locaisLidos.add(`${leitura.endereco_lido || '-'} (${leitura.deposito_lido || '-'})`);
    if (leitura.local_incorreto) linha.teveLocalIncorreto = true;
    if (leitura.nome_operador) linha.operadores.add(leitura.nome_operador);
  });

  // 3. Status final
  return linhas.map(({ sap: _sap, locaisLidos, operadores, ...linha }) => ({
    ...linha,
    diferenca: arredondar(linha.quantidade_fisica - linha.quantidade_sap),
    status: calcularStatus(linha),
    locais_lidos: Array.from(locaisLidos).join(', ') || '-',
    operador_str: Array.from(operadores).join(', ') || '-',
  }));
};

export const filtrarEOrdenar = (linhas, filtros, ordenacao) => {
  const busca = (filtros.material || '').toLowerCase();
  const dep = (filtros.deposito || '').toLowerCase();
  const asc = ordenacao.order === 'asc' ? 1 : -1;
  const campo = { material: 'material', status: 'status', deposito: 'deposito_sap' }[ordenacao.field];

  const filtradas = linhas.filter(l => {
    if (busca && !l.material.toLowerCase().includes(busca) && !String(l.texto_breve).toLowerCase().includes(busca)) return false;
    if (filtros.status && l.status !== filtros.status) return false;
    if (dep && !String(l.deposito_sap).toLowerCase().includes(dep) && !l.locais_lidos.toLowerCase().includes(dep)) return false;
    return true;
  });
  if (!campo) return filtradas;
  return filtradas.sort((a, b) => String(a[campo]).localeCompare(String(b[campo]), 'pt-BR', { numeric: true }) * asc);
};

export const calcularEstatisticas = (linhas) => {
  const stats = { totalItens: linhas.length, totalOk: 0, totalFalta: 0, totalSobra: 0, totalLocalIncorreto: 0, totalNaoEncontrado: 0 };
  const campo = {
    OK: 'totalOk', FALTA: 'totalFalta', SOBRA: 'totalSobra',
    LOCAL_INCORRETO: 'totalLocalIncorreto', NAO_ENCONTRADO: 'totalNaoEncontrado',
  };
  linhas.forEach(l => { stats[campo[l.status]]++; });
  return stats;
};
