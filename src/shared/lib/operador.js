// src/shared/lib/operador.js — Utilitários de exibição do operador.
export const obterIniciais = (nome) => {
  if (!nome) return 'OP';
  const partes = nome.trim().split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return partes[0].substring(0, 2).toUpperCase();
};
