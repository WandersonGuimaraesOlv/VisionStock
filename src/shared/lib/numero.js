// src/shared/lib/numero.js — Conversão de números vindos do SAP / digitados (pt-BR e en-US).

/**
 * Converte "1.234,5", "1234,5", "1234.5", "1.000" (milhar) em número.
 * Retorna 0 para valores vazios ou inválidos.
 */
export const parseNumero = (valor) => {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  let str = String(valor).trim().replace(/\s/g, '');
  if (!str) return 0;

  const temVirgula = str.includes(',');
  const temPonto = str.includes('.');

  if (temVirgula && temPonto) {
    // O separador que aparece por último é o decimal
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (temVirgula) {
    str = str.replace(',', '.');
  } else if (temPonto && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(str)) {
    // "1.000" / "12.345.678": ponto como separador de milhar (padrão SAP pt-BR)
    str = str.replace(/\./g, '');
  }

  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
};
