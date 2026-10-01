import { describe, it, expect } from 'vitest';
import { conciliar, calcularEstatisticas, filtrarEOrdenar } from '../src/modules/conciliacao/conciliar';
import { gerarCsvConciliacao } from '../src/modules/conciliacao/exportarCsv';
import { indexarPorMaterial, validarLeitura } from '../src/modules/inventario/validarLeitura';

const sap = [
  { material: 'A', texto_breve: 'Item A', endereco: 'P1', deposito: '1001', quantidade_sap: 10 },
  { material: 'B', texto_breve: 'Item B', endereco: 'P2', deposito: '1001', quantidade_sap: 5 },
  { material: 'C', texto_breve: 'Item C', endereco: 'P3', deposito: '1001', quantidade_sap: 4 },
  // Mesmo material em dois endereços
  { material: 'D', texto_breve: 'Item D', endereco: 'P4', deposito: '1001', quantidade_sap: 2 },
  { material: 'D', texto_breve: 'Item D', endereco: 'P9', deposito: '1002', quantidade_sap: 3 },
  { material: 'E', texto_breve: 'Item E', endereco: 'P5', deposito: '1001', quantidade_sap: 1 },
];

const leitura = (material, qtd, deposito, endereco, extra = {}) => ({
  material, quantidade_fisica: qtd, deposito_lido: deposito, endereco_lido: endereco, nome_operador: 'Ana', ...extra,
});

describe('conciliar (RN-004)', () => {
  const leituras = [
    leitura('A', 4, '1001', 'P1'),
    leitura('A', 6, '1001', 'P1'),
    leitura('B', 2, '1001', 'P2'),
    leitura('C', 0.1, '1001', 'P3'),
    leitura('C', 0.2, '1001', 'P3'),
    leitura('D', 3, '1002', 'P9'),
    leitura('E', 1, '1001', 'P7', { local_incorreto: true }),
    leitura('Z', 1, '1001', 'P1'),
  ];
  const linhas = conciliar(sap, leituras);
  const linha = (material, deposito) => linhas.find(l => l.material === material && (!deposito || l.deposito_sap === deposito));

  it('marca OK, Falta, Sobra, Local Incorreto e Não Encontrado', () => {
    expect(linha('A').status).toBe('OK');
    expect(linha('A').quantidade_fisica).toBe(10);
    expect(linha('B').status).toBe('FALTA');
    expect(linha('B').diferenca).toBe(-3);
    expect(linha('E').status).toBe('LOCAL_INCORRETO');
    expect(linha('Z').status).toBe('SOBRA');
    expect(linha('Z').deposito_sap).toBe('-');
  });

  it('soma decimais sem erro de ponto flutuante', () => {
    expect(linha('C').quantidade_fisica).toBe(0.3);
  });

  it('credita a leitura no endereço certo quando o material existe em vários locais', () => {
    expect(linha('D', '1002').quantidade_fisica).toBe(3);
    expect(linha('D', '1002').status).toBe('OK');
    expect(linha('D', '1001').status).toBe('NAO_ENCONTRADO');
  });

  it('calcula estatísticas', () => {
    expect(calcularEstatisticas(linhas)).toEqual({
      totalItens: 7, totalOk: 2, totalFalta: 2, totalSobra: 1, totalLocalIncorreto: 1, totalNaoEncontrado: 1,
    });
  });

  it('filtra por status e busca', () => {
    expect(filtrarEOrdenar(linhas, { status: 'FALTA' }, { field: 'material', order: 'asc' }).map(l => l.material)).toEqual(['B', 'C']);
    expect(filtrarEOrdenar(linhas, { material: 'item a' }, { field: 'material', order: 'asc' })).toHaveLength(1);
  });

  it('exporta CSV com vírgula decimal e aspas escapadas', () => {
    const csv = gerarCsvConciliacao([{ ...linha('C'), texto_breve: 'Tubo 1/2"' }]);
    expect(csv).toContain('"Tubo 1/2"""');
    expect(csv).toContain(';0,3;');
  });
});

describe('validarLeitura (RN-003)', () => {
  const indice = indexarPorMaterial(sap);

  it('não acusa local incorreto se o material existe no local informado', () => {
    const r = validarLeitura('D', indice, '1002', 'p9');
    expect(r.localIncorreto).toBe(false);
    expect(r.endereco_sap).toBe('P9');
  });
  it('acusa local incorreto e permite o registro', () => {
    const r = validarLeitura('A', indice, '1002', '');
    expect(r.localIncorreto).toBe(true);
    expect(r.itemEncontrado).toBe(true);
  });
  it('item fora da base', () => {
    expect(validarLeitura('nada', indice, '1001', '').itemEncontrado).toBe(false);
    expect(validarLeitura('   ', indice, '1001', '')).toBeNull();
  });
});
