// src/db.js — Instância do Dexie.js (IndexedDB Local)
// Camada de persistência local para o padrão Offline-First (ALMOX Universal).
import Dexie from 'dexie';

const db = new Dexie('InventarioAlmoxDB');

/**
 * Schema v2 do banco local ALMOX:
 * - leituras_pendentes: Fila de sincronização offline de contagens de materiais.
 * - itens_sap_cache: Cache local da base SAP "ETIQUETAS" importada.
 */
db.version(2).stores({
  leituras_pendentes: '++id, _status, sessao_id, material, endereco, deposito, quantidade_fisica, _criado_em',
  itens_sap_cache: '++id, sessao_id, material, texto_breve, endereco, deposito, quantidade_sap',
});

export default db;
