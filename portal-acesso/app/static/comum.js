/* exported BASE, api, el, sair */
// Chamadas à API do portal (o cabeçalho X-Portal protege contra formulários de outros sites)
const BASE = '/acesso';

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(BASE + caminho, {
    method: opcoes.method || 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Portal': '1' },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  let dados = null;
  try { dados = await resposta.json(); } catch { /* resposta sem corpo */ }
  if (!resposta.ok) {
    const detalhe = dados && dados.detail;
    const erro = new Error(typeof detalhe === 'string' ? detalhe : 'Não foi possível concluir. Confira os dados.');
    erro.status = resposta.status;
    erro.dados = dados;
    throw erro;
  }
  return dados;
}

function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (chave.startsWith('on')) no.addEventListener(chave.slice(2), valor);
    else if (chave === 'class') no.className = valor;
    else if (valor === true) no.setAttribute(chave, '');
    else if (valor !== false && valor != null) no.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) if (filho != null) no.append(filho);
  return no;
}

async function sair() {
  try { await api('/api/sair', { method: 'POST' }); } finally { location.href = BASE + '/entrar'; }
}
