// src/modules/conciliacao/exportarCsv.js — Relatório final conciliado em CSV (Excel pt-BR).
import { ROTULO_STATUS } from './conciliar';

const texto = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const numero = (n) => String(n).replace('.', ',');

export const gerarCsvConciliacao = (linhas) => {
  let csv = '\uFEFF'; // BOM UTF-8 para o Excel abrir acentos corretamente
  csv += 'Material;Texto Breve Material;Depósito SAP;Endereço SAP;Qtd SAP;Qtd Física Contada;Diferença;Status Conciliação;Locais Lidos;Operador\n';
  linhas.forEach(l => {
    csv += [
      texto(l.material),
      texto(l.texto_breve),
      texto(l.deposito_sap),
      texto(l.endereco_sap),
      numero(l.quantidade_sap),
      numero(l.quantidade_fisica),
      numero(l.diferenca),
      texto(ROTULO_STATUS[l.status]),
      texto(l.locais_lidos),
      texto(l.operador_str),
    ].join(';') + '\n';
  });
  return csv;
};

export const baixarCsvConciliacao = (linhas) => {
  const blob = new Blob([gerarCsvConciliacao(linhas)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `conciliacao_almox_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
