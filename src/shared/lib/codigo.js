// src/shared/lib/codigo.js — Normalização e extração do código do Material (RN-001).

/** Normaliza o código: numérico perde zeros à esquerda, alfanumérico vira maiúsculo. */
export const limparCodigo = (codigo) => {
  if (codigo === null || codigo === undefined) return '';
  const str = String(codigo).trim();
  if (!str) return '';
  if (/^\d+$/.test(str)) {
    return str.replace(/^0+/, '') || '0';
  }
  return str.toUpperCase();
};

/**
 * Resolve o Material a partir do conteúdo bruto de uma etiqueta (RN-001).
 * A etiqueta pode ter dados concatenados (ex: "MAT:12345;LOTE:9;QTD:10" ou "000012345 PARAFUSO").
 * Tenta, em ordem: o texto inteiro, depois cada pedaço separado por delimitadores comuns,
 * aceitando o primeiro que existir na base SAP.
 *
 * @param {string} bruto conteúdo lido
 * @param {(material: string) => boolean} existeNaBase verifica se o material está na base SAP
 * @returns {{ material: string, encontrado: boolean }}
 */
export const resolverMaterial = (bruto, existeNaBase) => {
  const inteiro = limparCodigo(bruto);
  if (!inteiro) return { material: '', encontrado: false };
  if (existeNaBase(inteiro)) return { material: inteiro, encontrado: true };

  const pedacos = String(bruto)
    .split(/[\s;|,/\\\t:=]+/)
    .map(limparCodigo)
    .filter(Boolean);

  for (const pedaco of pedacos) {
    if (existeNaBase(pedaco)) return { material: pedaco, encontrado: true };
  }
  return { material: inteiro, encontrado: false };
};
