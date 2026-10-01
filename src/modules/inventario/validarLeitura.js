// src/modules/inventario/validarLeitura.js — Validação da leitura contra a base SAP (RN-001 e RN-003).
import { resolverMaterial } from '../../shared/lib/codigo';
import { mesmoLocal } from '../../shared/lib/local';

/** Agrupa os itens SAP por Material (o mesmo SKU pode estar em vários endereços). */
export const indexarPorMaterial = (itensSap) => {
  const indice = new Map();
  itensSap.forEach(item => {
    if (!indice.has(item.material)) indice.set(item.material, []);
    indice.get(item.material).push(item);
  });
  return indice;
};

/**
 * Monta o item que vai para o modal de quantidade a partir do código lido.
 * @returns {null | { material, texto_breve, endereco_sap, deposito_sap, localIncorreto, itemEncontrado }}
 */
export const validarLeitura = (codigoBruto, indice, depositoAtual, enderecoAtual) => {
  const { material, encontrado } = resolverMaterial(codigoBruto, (m) => indice.has(m));
  if (!material) return null;

  if (!encontrado) {
    return {
      material,
      texto_breve: 'Item não cadastrado no SAP',
      endereco_sap: '-',
      deposito_sap: '-',
      localIncorreto: false,
      itemEncontrado: false,
    };
  }

  const candidatos = indice.get(material);
  const noLocal = candidatos.find(item => mesmoLocal(item, depositoAtual, enderecoAtual));
  const referencia = noLocal || candidatos[0];
  return {
    material,
    texto_breve: referencia.texto_breve,
    endereco_sap: referencia.endereco,
    deposito_sap: referencia.deposito,
    localIncorreto: !noLocal,
    itemEncontrado: true,
  };
};
