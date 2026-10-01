// src/modules/drone/droneApi.js — Cliente HTTP do backend de visão computacional (FastAPI).
import { config } from '../../app/config';

const CHAVE_URL_CUSTOM = 'almox_api_url_custom';

export const limparUrl = (url) => (url || '').trim().replace(/\/+$/, '');

/** URL padrão: VITE_API_URL ou o próprio domínio do app (Nginx faz proxy de /api). */
export const urlPadrao = () => config.apiUrl || '';

export const lerUrlSalva = () => {
  try {
    // Remove URLs antigas de túneis temporários salvas por versões anteriores
    localStorage.removeItem('VITE_API_URL_CUSTOM');
    return localStorage.getItem(CHAVE_URL_CUSTOM) ?? urlPadrao();
  } catch {
    return urlPadrao();
  }
};

export const salvarUrl = (url) => {
  try {
    if (limparUrl(url) === urlPadrao()) localStorage.removeItem(CHAVE_URL_CUSTOM);
    else localStorage.setItem(CHAVE_URL_CUSTOM, limparUrl(url));
  } catch { /* sem armazenamento: vale só nesta tela */ }
};

export const testarConexao = async (baseUrl) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${limparUrl(baseUrl)}/api/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const data = res.ok ? await res.json().catch(() => null) : null;
    return data?.status === 'online';
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

/** Envia o vídeo com acompanhamento de progresso (XHR, pois fetch não informa upload). */
export const enviarVideo = (baseUrl, arquivo, aoProgredir) => new Promise((resolve, reject) => {
  const formData = new FormData();
  formData.append('file', arquivo);

  const xhr = new XMLHttpRequest();
  xhr.upload.onprogress = (evento) => {
    if (evento.lengthComputable) aoProgredir?.({ fase: 'upload', enviado: evento.loaded, total: evento.total });
  };
  xhr.upload.onload = () => aoProgredir?.({ fase: 'processando' });

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error('Resposta inválida do servidor.'));
      }
      return;
    }
    let detalhe = '';
    try { detalhe = JSON.parse(xhr.responseText)?.detail || ''; } catch { /* corpo não JSON */ }
    if (xhr.status === 413) reject(new Error(detalhe || 'O vídeo excede o tamanho máximo aceito pelo servidor.'));
    else if (xhr.status === 403) reject(new Error('Chave de acesso do servidor de IA inválida (VITE_API_KEY).'));
    else reject(new Error(detalhe || `Falha no servidor (Código HTTP: ${xhr.status}).`));
  };
  xhr.onerror = () => reject(new Error('Erro de conexão com o servidor de IA. Verifique a rede ou a URL do servidor.'));
  xhr.ontimeout = () => reject(new Error('O tempo limite esgotou. A rede está muito lenta para este arquivo.'));

  xhr.open('POST', `${limparUrl(baseUrl)}/api/processar-drone`);
  if (config.apiKey) xhr.setRequestHeader('X-API-KEY', config.apiKey);
  xhr.timeout = 15 * 60 * 1000; // upload + processamento de vídeos longos
  xhr.send(formData);
});
