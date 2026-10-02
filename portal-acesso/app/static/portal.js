// Incluído no Portal de Aplicações (página inicial do servidor) com:
//   <script src="/acesso/portal.js" defer></script>
// Esconde os cards dos sistemas que o usuário não pode abrir e mostra quem está logado.
// A proteção de verdade fica no Nginx (auth_request); isto só arruma a vitrine.
(function () {
  const BASE = '/acesso';

  function caminhoDo(link) {
    try { return new URL(link.href, location.href).pathname; } catch { return ''; }
  }

  function pertence(caminho, sistema) {
    return caminho === sistema || caminho + '/' === sistema || caminho.startsWith(sistema);
  }

  function barra(conteudo) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;display:flex;gap:10px;align-items:center;'
      + 'background:#161b22;border:1px solid #30363d;border-radius:99px;padding:6px 14px;font:14px system-ui,sans-serif;color:#e6edf3';
    div.innerHTML = conteudo;
    document.body.append(div);
    return div;
  }

  const estiloLink = 'color:#58a6ff;text-decoration:none';

  fetch(BASE + '/api/eu', { credentials: 'same-origin' }).then(async (resposta) => {
    const dados = await resposta.json();
    if (resposta.status === 401) {
      if (dados.modo === 'bloquear') {
        location.href = BASE + '/entrar?volta=' + location.pathname;
        return;
      }
      barra(`<a href="${BASE}/entrar?volta=/" style="${estiloLink}">Entrar</a>`);
      return;
    }
    if (!resposta.ok) return;

    const liberados = dados.sistemas.map((s) => s.caminho);
    document.querySelectorAll('a[href]').forEach((link) => {
      const caminho = caminhoDo(link);
      const protegido = dados.todos_caminhos.some((s) => pertence(caminho, s));
      if (protegido && !liberados.some((s) => pertence(caminho, s))) {
        (link.closest('.app-card') || link).style.display = 'none';
      }
    });

    const nome = document.createElement('span');
    nome.textContent = dados.nome;
    const div = barra(
      `<span></span>`
      + `<a href="${BASE}/" style="${estiloLink}">${dados.admin ? 'Gerenciar acessos' : 'Minha conta'}</a>`
      + `<a href="#" style="${estiloLink}" data-sair>Sair</a>`,
    );
    div.firstChild.replaceWith(nome);
    div.querySelector('[data-sair]').addEventListener('click', async (ev) => {
      ev.preventDefault();
      await fetch(BASE + '/api/sair', { method: 'POST', credentials: 'same-origin', headers: { 'X-Portal': '1' } });
      location.href = BASE + '/entrar?volta=/';
    });
  }).catch(() => { /* portal de acesso fora do ar: a página continua como era */ });
})();
