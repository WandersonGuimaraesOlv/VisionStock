import { describe, it, expect } from 'vitest';
import { limparCodigo, resolverMaterial } from '../src/shared/lib/codigo';
import { parseNumero } from '../src/shared/lib/numero';

describe('limparCodigo', () => {
  it('remove zeros à esquerda de códigos numéricos', () => {
    expect(limparCodigo('000012345')).toBe('12345');
    expect(limparCodigo('0000')).toBe('0');
  });
  it('normaliza alfanuméricos para maiúsculas', () => {
    expect(limparCodigo('  abc-12 ')).toBe('ABC-12');
  });
  it('trata vazio e nulo', () => {
    expect(limparCodigo('')).toBe('');
    expect(limparCodigo(null)).toBe('');
  });
});

describe('resolverMaterial (RN-001)', () => {
  const base = new Set(['12345', 'PAR-10']);
  const existe = (m) => base.has(m);

  it('aceita o código puro', () => {
    expect(resolverMaterial('00012345', existe)).toEqual({ material: '12345', encontrado: true });
  });
  it('extrai o Material de etiqueta com dados concatenados', () => {
    expect(resolverMaterial('LOTE:999;MAT:00012345;QTD:10', existe)).toEqual({ material: '12345', encontrado: true });
    expect(resolverMaterial('par-10 PARAFUSO SEXTAVADO', existe)).toEqual({ material: 'PAR-10', encontrado: true });
  });
  it('devolve o código limpo quando não está na base', () => {
    expect(resolverMaterial('xyz', existe)).toEqual({ material: 'XYZ', encontrado: false });
  });
});

describe('parseNumero', () => {
  it('entende formatos pt-BR e en-US', () => {
    expect(parseNumero('1.234,5')).toBe(1234.5);
    expect(parseNumero('12,5')).toBe(12.5);
    expect(parseNumero('12.5')).toBe(12.5);
    expect(parseNumero('1,234.5')).toBe(1234.5);
    expect(parseNumero('1.000')).toBe(1000);
    expect(parseNumero('0.500')).toBe(0.5);
  });
  it('retorna 0 para inválidos', () => {
    expect(parseNumero('')).toBe(0);
    expect(parseNumero('abc')).toBe(0);
    expect(parseNumero(undefined)).toBe(0);
  });
});
