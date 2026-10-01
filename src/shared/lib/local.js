// src/shared/lib/local.js — Comparação de Depósito / Endereço (RN-003).

export const normalizarLocal = (valor) => String(valor ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

/**
 * Verifica se um item SAP está no local informado pelo operador.
 * Campos não informados pelo operador (vazios) não são comparados.
 */
export const mesmoLocal = (itemSap, deposito, endereco) => {
  const depOk = !normalizarLocal(deposito) || normalizarLocal(itemSap.deposito) === normalizarLocal(deposito);
  const endOk = !normalizarLocal(endereco) || normalizarLocal(itemSap.endereco) === normalizarLocal(endereco);
  return depOk && endOk;
};
