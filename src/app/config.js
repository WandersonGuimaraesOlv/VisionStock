// src/app/config.js — Configuração central lida das variáveis VITE_* em tempo de build.
// Nenhum outro arquivo deve ler import.meta.env diretamente.

const limparUrl = (url) => (url || '').trim().replace(/\/+$/, '');

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  // Tabela do Supabase que recebe as contagens físicas sincronizadas
  tabelaLeituras: import.meta.env.VITE_SUPABASE_TABELA_LEITURAS || 'leituras_almox',
  // URL do backend de drone. Vazio = mesmo domínio do app (Nginx faz proxy de /api)
  apiUrl: limparUrl(import.meta.env.VITE_API_URL),
  apiKey: import.meta.env.VITE_API_KEY || '',
};
