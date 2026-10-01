import { describe, it, expect } from 'vitest';
import { parsePlanilhaEtiquetas } from '../src/modules/importacao-sap/parserEtiquetas';

describe('parsePlanilhaEtiquetas', () => {
  it('lê CSV com ; e cabeçalhos do SAP', () => {
    const csv = '﻿Material;Texto breve material;Endereço;Depósito;Quantidade SAP\n' +
      '000123;"Parafuso; sextavado";P12 A 13;1001;1.250,5\n' +
      ';sem material;;;\n' +
      'ABC;Arruela;P01;1002;3\n';
    const { itens, erro, linhasIgnoradas } = parsePlanilhaEtiquetas(csv);
    expect(erro).toBeUndefined();
    expect(linhasIgnoradas).toBe(1);
    expect(itens).toEqual([
      { material: '123', texto_breve: 'Parafuso; sextavado', endereco: 'P12 A 13', deposito: '1001', quantidade_sap: 1250.5 },
      { material: 'ABC', texto_breve: 'Arruela', endereco: 'P01', deposito: '1002', quantidade_sap: 3 },
    ]);
  });

  it('pula linhas de título antes do cabeçalho e aceita vírgula', () => {
    const csv = 'Relatório ETIQUETAS\nMaterial,Quantidade\n55,2.5\n';
    const { itens } = parsePlanilhaEtiquetas(csv);
    expect(itens).toEqual([{ material: '55', texto_breve: 'Sem descrição', endereco: '-', deposito: 'Padrão', quantidade_sap: 2.5 }]);
  });

  it('exige a coluna Material', () => {
    expect(parsePlanilhaEtiquetas('Nome;Qtd\nx;1').erro).toMatch(/Material/);
    expect(parsePlanilhaEtiquetas('').erro).toMatch(/vazio/);
  });
});
