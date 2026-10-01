// src/app/estados.js — Máquina de estados do fluxo operacional.
// LOGIN → IMPORT_SAP → SELECAO_LOCAL → BIPAGEM → (INPUT_QUANTIDADE em modal) → CONCILIAÇÃO (painel)
export const ETAPAS = {
  IMPORT_SAP: 'IMPORT_SAP',
  SELECAO_LOCAL: 'SELECAO_LOCAL',
  BIPAGEM: 'BIPAGEM',
};
