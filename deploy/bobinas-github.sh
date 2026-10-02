#!/usr/bin/env bash
# Inventário de Bobinas no servidor a partir do GitHub (cópia do Wanderson, ramo melhorias-inventario-v2.4).
# Hoje a pasta /var/www/inventario-bobinas tem só o site pronto (dist) enviado do PC; o código-fonte não está nela.
# Depois do "aplicar", a pasta vira um clone do GitHub e o site é gerado aqui mesmo, num container Node.
#
# Uso:  bash bobinas-github.sh testar       só compara: gera o site do GitHub numa pasta temporária e confere com o
#                                           que está no ar (site e backend do drone). Não muda nada.
#       bash bobinas-github.sh aplicar      backup + pasta vira clone do GitHub + publica o site gerado do GitHub.
#                                           O backend do drone não é mexido (o "testar" confere que é o mesmo código).
#       bash bobinas-github.sh atualizar    baixa do GitHub; gera e publica o site; reconstrói o backend do drone só
#                                           se ele mudou. Se algo falhar, site e backend voltam para o que estava.
#       bash bobinas-github.sh voltar-site  volta o site para a versão publicada antes da atual.
#       bash bobinas-github.sh situacao     mostra ramo, commit, versões do site e o container do drone.
#       bash bobinas-github.sh desfazer     volta a pasta e o backend do drone para como estavam antes do "aplicar".
#
# Variáveis opcionais: FORCAR=1 (aplicar: aplica mesmo com diferenças no "testar"; atualizar: gera o site de novo
# mesmo sem commit novo, ou segue o GitHub se o ramo foi reescrito), FORCAR_DRONE=1 (atualizar: reconstrói o backend
# do drone mesmo sem mudança), BOBINAS_REPO, BOBINAS_RAMO.
set -Eeuo pipefail
DIR=${BOBINAS_DIR:-/var/www/inventario-bobinas}
REPO=${BOBINAS_REPO:-https://github.com/WandersonGuimaraesOlv/inventario-bobinas.git}
RAMO=${BOBINAS_RAMO:-melhorias-inventario-v2.4}
NODE_IMG=node:22-slim
VERSOES=site-versoes                       # dentro de $DIR; "dist" vira um link para a versão no ar
BACKUPS=~/backups
ULTIMO_BACKUP=$BACKUPS/bobinas-antes-github.ultimo
MARCA_OK=$DIR/.git/aplicado-ok             # só existe se o "aplicar" terminou
SITE_NO_AR=$DIR/.git/site-no-ar            # commit do site publicado por último
DRONE_NO_AR=$DIR/.git/drone-no-ar          # commit do backend do drone que está rodando
IMAGEM_OK=$DIR/.git/drone-imagem-ok        # id da imagem do drone que está funcionando
HISTORICO=$DIR/.git/site-historico         # versões publicadas, da mais antiga para a atual
TS=$(date +%Y%m%d-%H%M%S)
EU=$(readlink -f "${BASH_SOURCE[0]}")

exec 9>/tmp/bobinas-github.lock
flock -n 9 || { echo "Outro bobinas-github.sh já está rodando. Espere ele terminar."; exit 1; }

# ---------------------------------------------------------------------------------------------------------------
# Lê o endereço e a chave do Supabase de dentro do site que está no ar, para gerar o site novo com os mesmos.
# Eles já vão dentro do site para o navegador; aqui só ficam num .env com permissão 600. A chave nunca é mostrada.
extrair_env() {  # $1 = pasta do site
  local js
  js=$(grep -o '/bobinas/assets/[^"]*\.js' "$1/index.html" | head -1) || true
  [ -n "$js" ] && [ -f "$1/${js#/bobinas/}" ] || { echo "ERRO: não achei o JavaScript do site em $1" >&2; return 1; }
  python3 - "$1/${js#/bobinas/}" <<'PY'
import base64, json, re, sys
txt = open(sys.argv[1], encoding="utf-8", errors="replace").read()
urls = sorted(set(re.findall(r"https://[a-z0-9]{20}\.supabase\.co", txt)))
chaves = sorted(set(re.findall(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", txt))
                | set(re.findall(r"sb_(?:publishable|secret)_[A-Za-z0-9_-]{10,}", txt)))
if len(urls) != 1 or len(chaves) != 1:
    sys.exit(f"ERRO: esperava 1 endereço e 1 chave do Supabase no site, achei {len(urls)} e {len(chaves)}")
chave = chaves[0]
papel = "secret" if chave.startswith("sb_secret_") else "publishable" if chave.startswith("sb_") else "?"
if chave.startswith("eyJ"):
    try:
        meio = chave.split(".")[1]
        papel = json.loads(base64.urlsafe_b64decode(meio + "=" * (-len(meio) % 4))).get("role", "?")
    except Exception:
        pass
if papel in ("service_role", "secret"):
    print("  ATENÇÃO: o site usa a chave SECRETA do Supabase (" + papel + "), que dá acesso total ao banco para quem"
          " abrir o site. O site novo continua com a mesma chave (nada piora); trocar pela chave pública é outro passo.",
          file=sys.stderr)
print(f"VITE_SUPABASE_URL={urls[0]}")
print(f"VITE_SUPABASE_ANON_KEY={chave}")
PY
}

# Gera o site com Node dentro de um container (o servidor não precisa ter Node instalado).
construir() {  # $1 = pasta do código (com .env)  $2 = pasta de saída, relativa a $1
  echo "  gerando o site (npm ci + vite build em $NODE_IMG)..."
  if ! docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
      -e npm_config_update_notifier=false -v "$1:/app" -w /app "$NODE_IMG" \
      sh -c "npm ci --no-audit --no-fund --loglevel=error && npm run build -- --outDir '$2' --emptyOutDir --logLevel warn" \
      >/tmp/bobinas-build.log 2>&1; then
    tail -30 /tmp/bobinas-build.log; rm -rf "${1:?}/$2"; echo "ERRO: o site não foi gerado (log acima)"; return 1
  fi
  conferir_site "$1/$2" || { rm -rf "${1:?}/$2"; return 1; }
}

# O site tem que carregar o JavaScript de /bobinas/assets/, todos os arquivos citados têm que existir e o
# JavaScript tem que ter o endereço e a chave do Supabase (sem eles a tela fica branca).
conferir_site() {  # $1 = pasta do site
  local refs ref
  [ -f "$1/index.html" ] || { echo "ERRO: $1/index.html não existe"; return 1; }
  refs=$(grep -o '/bobinas/assets/[^"]*' "$1/index.html") || true
  echo "$refs" | grep -q '\.js$' || { echo "ERRO: $1/index.html não carrega nenhum JavaScript de /bobinas/assets/ (mudou o base do Vite?)"; return 1; }
  for ref in $refs; do
    [ -f "$1/${ref#/bobinas/}" ] || { echo "ERRO: $1 aponta para $ref, que não existe"; return 1; }
  done
  extrair_env "$1" >/dev/null 2>&1 || { echo "ERRO: o site em $1 está sem o endereço/chave do Supabase (falta o .env?)"; return 1; }
}

# Compara o site gerado do GitHub com o que está no ar. Os nomes com hash podem mudar; o conteúdo não.
# O site no ar foi gerado num PC Windows: diferença só de quebra de linha (\r) é avisada mas conta como igual.
comparar_sites() {  # $1 = novo  $2 = no ar.  Saída 0 = iguais
  python3 - "$1" "$2" <<'PY'
import os, re, sys
novo, noar = sys.argv[1:3]
TEXTO = (".html", ".js", ".css", ".json", ".txt", ".svg", ".webmanifest")
def ocultar(b):  # nunca mostra chave na tela
    return re.sub(rb"(eyJ|sb_secret_|sb_publishable_)[A-Za-z0-9_.-]{10,}", rb"\1...(chave oculta)", b)
def sem_cr(p, b):
    return b.replace(b"\r", b"") if p.endswith(TEXTO) else b
def refs(d):
    html = open(os.path.join(d, "index.html"), encoding="utf-8").read()
    return {os.path.splitext(r)[1]: r for r in re.findall(r"/bobinas/(assets/[^\"]+\.(?:js|css))", html)}
def sem_hash(b):
    return re.sub(rb"(assets/[\w.-]+?)-[\w-]{8}\.(js|css|png|svg|jpg|webp)", rb"\1.\2", b)
def arquivos(d):  # tudo menos JS/CSS com hash (no ar há pacotes antigos guardados de propósito)
    for raiz, _, nomes in os.walk(d):
        for n in nomes:
            rel = os.path.relpath(os.path.join(raiz, n), d)
            if not (rel.startswith("assets" + os.sep) and n.endswith((".js", ".css"))):
                yield rel
dif = []
pares = []
rn, ra = refs(novo), refs(noar)
for ext in sorted(set(rn) | set(ra)):
    if ext not in rn or ext not in ra:
        dif.append(f"{ext}: o index.html de um carrega {ext} e o do outro não"); continue
    pares.append((rn[ext], ra[ext]))
for rel in sorted(set(arquivos(novo)) | set(arquivos(noar))):
    pares.append((rel, rel))
for pn, pa in pares:
    fn, fa = os.path.join(novo, pn), os.path.join(noar, pa)
    if not os.path.isfile(fn): dif.append(f"{pa}: existe no ar e não no site do GitHub"); continue
    if not os.path.isfile(fa): dif.append(f"{pn}: existe no site do GitHub e não no ar"); continue
    bn, ba = open(fn, "rb").read(), open(fa, "rb").read()
    if pn == "index.html":
        bn, ba = sem_hash(bn), sem_hash(ba)
    nome = pn + ("" if pn == pa else f"  (no ar: {pa})")
    if bn == ba:
        print(f"  igual      {nome}"); continue
    bn, ba = sem_cr(pn, bn), sem_cr(pa, ba)
    if bn == ba:
        print(f"  igual      {nome}  (só quebra de linha do Windows)"); continue
    i = next((k for k in range(min(len(bn), len(ba))) if bn[k] != ba[k]), min(len(bn), len(ba)))
    dif.append(f"{pn}: {len(bn)} x {len(ba)} bytes, primeira diferença no byte {i}\n"
               f"      GitHub: {ocultar(bn[max(0, i - 60):i + 60])!r}\n      no ar:  {ocultar(ba[max(0, i - 60):i + 60])!r}")
for d in dif:
    print("  DIFERENTE  " + d)
sys.exit(1 if dif else 0)
PY
}

# Compara cada arquivo do backend do GitHub com o que está DENTRO do container do drone que está rodando.
comparar_backend() {  # $1 = clone do GitHub
  local f r=0
  docker inspect drone-backend-app >/dev/null 2>&1 || { echo "  DIFERENTE  container drone-backend-app não está rodando"; return 1; }
  for f in $(git -C "$1" ls-files backend | grep -v -e '/\.gitignore$' -e '/\.dockerignore$'); do
    if cmp -s <(tr -d '\r' < "$1/$f") <(docker exec drone-backend-app cat "/app/${f#backend/}" 2>/dev/null | tr -d '\r'); then
      echo "  igual      $f (no container do drone)"
    else echo "  DIFERENTE  $f (no container do drone)"; r=1; fi
  done
  return $r
}

responde_drone() { for _ in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:8000/ && return 0; sleep 3; done; return 1; }

# Copia este script para outro lugar sem estragar uma cópia que esteja rodando (arquivo novo + troca de nome).
instalar() {  # $1 = origem  $2 = destino
  [ "$1" -ef "$2" ] && return 0
  cp "$1" "$2.novo.$$" && mv -f "$2.novo.$$" "$2"
}

# Aponta o link "dist" para outra versão numa operação só (o Nginx serve /var/www/inventario-bobinas/dist/).
trocar_link() {  # $1 = pasta da versão, relativa a $DIR
  ln -sfn "$1" "$DIR/dist.novo" && mv -Tf "$DIR/dist.novo" "$DIR/dist"
}

# Troca dois caminhos de lugar numa operação só do Linux (renameat2 RENAME_EXCHANGE).
trocar_de_lugar() {
  python3 - "$1" "$2" <<'PY2'
import ctypes, sys
libc = ctypes.CDLL(None, use_errno=True)
sys.exit(0 if libc.renameat2(-100, sys.argv[1].encode(), -100, sys.argv[2].encode(), 2) == 0 else 1)
PY2
}

# Copia para a versão que vai ao ar os assets da versão que está no ar, para quem está com o site aberto continuar
# funcionando (o index.html antigo pede arquivos com outros nomes).
juntar_assets() {  # $1 = versão no ar  $2 = versão que vai ao ar
  local f
  for f in "$1"/assets/*; do
    [ -e "$f" ] && [ ! -e "$2/assets/${f##*/}" ] && cp -p "$f" "$2/assets/"
  done
  return 0
}

# Publica uma versão do site. Guarda a original e as 5 últimas publicadas.
publicar() {  # $1 = pasta da versão, relativa a $DIR
  cd "$DIR"
  local v
  juntar_assets "$(readlink -f dist)" "$1"
  if [ -d dist ] && [ ! -L dist ]; then
    # primeira vez: a pasta dist real vira a versão "0-original" e dá lugar ao link, numa operação só
    ln -sfn "$1" dist.novo
    if trocar_de_lugar dist.novo dist; then mv dist.novo "$VERSOES/0-original-$TS"
    else mv dist "$VERSOES/0-original-$TS" && mv -T dist.novo dist; fi
    echo "$VERSOES/0-original-$TS" >> "$HISTORICO"
  else
    trocar_link "$1"
  fi
  echo "$1" >> "$HISTORICO"
  conferir_site "$DIR/dist"
  echo "  NO AR: dist -> $(readlink dist)"
  for v in "$VERSOES"/2*; do
    [ -d "$v" ] || continue
    tail -n 5 "$HISTORICO" | grep -qxF "$v" || [ "$(readlink -f "$v")" = "$(readlink -f dist)" ] || rm -rf "$v"
  done
}

http_bobinas() { curl -s -o /dev/null -w "  /bobinas/ %{http_code} (302 = pede login, normal)\n" http://127.0.0.1/bobinas/; }

ja_aplicado() {  # 0 = aplicado; 1 = não; 2 = começou e parou no meio
  [ "$(git -C "$DIR" config --get remote.origin.url 2>/dev/null)" = "$REPO" ] || return 1
  [ -f "$MARCA_OK" ] || return 2
}

# ---------------------------------------------------------------------------------------------------------------
# Saída: 0 = igual, 1 = há diferenças, 2 = não conseguiu testar. Deixa TESTADO (commit) e BACKEND_IGUAL prontos.
testar() {
  local tmp r=0
  TESTADO=""; BACKEND_IGUAL=0
  tmp=$(mktemp -d /tmp/bobinas-teste.XXXXXX)
  echo "== 1/3 Baixando o ramo $RAMO de $REPO"
  git clone -q --depth 1 -b "$RAMO" "$REPO" "$tmp/src" || { rm -rf "$tmp"; echo "ERRO: não consegui baixar do GitHub"; return 2; }
  TESTADO=$(git -C "$tmp/src" rev-parse HEAD)
  git -C "$tmp/src" log -1 --format="  %h %ci %s"
  echo "== 2/3 Gerando o site do GitHub com o mesmo Supabase do site no ar"
  extrair_env "$DIR/dist" > "$tmp/src/.env" || { rm -rf "$tmp"; return 2; }
  construir "$tmp/src" site || { rm -rf "$tmp"; return 2; }
  echo "== 3/3 Comparando com o que está no ar"
  comparar_sites "$tmp/src/site" "$DIR/dist" || r=1
  if comparar_backend "$tmp/src"; then BACKEND_IGUAL=1; else r=1; fi
  rm -rf "$tmp"
  if [ $r = 0 ]; then echo "RESULTADO: IGUAL. O GitHub tem exatamente o que está no ar."
  else echo "RESULTADO: HÁ DIFERENÇAS (lista acima). Nada foi mudado."; fi
  return $r
}

aplicar() {
  cd "$DIR"
  local rt=0 bk env
  ja_aplicado || rt=$?
  if [ $rt = 0 ]; then echo "Já aplicado. Para atualizar: bash $DIR/atualizar-servidor.sh atualizar"; return 0; fi
  if [ $rt = 2 ]; then echo "O aplicar anterior parou no meio. Rode: bash $BACKUPS/bobinas-github.sh desfazer   e depois o aplicar de novo."; return 1; fi

  echo "##### Conferência antes de mexer"
  rt=0; testar || rt=$?
  if [ $rt = 2 ]; then echo "Parei sem mudar nada (o teste não conseguiu rodar)."; return 1; fi
  if [ $rt = 1 ] && [ "${FORCAR:-}" != 1 ]; then echo "Parei sem mudar nada. Para aplicar mesmo assim: FORCAR=1 bash $EU aplicar"; return 1; fi

  echo "##### 1/5 Backup da pasta (sem os vídeos do drone) e da imagem do drone"
  mkdir -p "$BACKUPS"
  bk=$BACKUPS/bobinas-antes-github-$TS.tgz
  tar -czf "$bk" --exclude='backend/videos_drone' -C "$(dirname "$DIR")" "$(basename "$DIR")"
  echo "$bk" > "$ULTIMO_BACKUP"
  ls -lh "$bk"
  docker image inspect drone-backend:antes-github >/dev/null 2>&1 || \
    docker image tag "$(docker inspect -f '{{.Image}}' drone-backend-app)" drone-backend:antes-github
  env=$(extrair_env "$DIR/dist" 2>/dev/null)   # o aviso da chave já apareceu no teste
  instalar "$EU" "$BACKUPS/bobinas-github.sh"
  trap '{ echo; echo "ERRO na linha $LINENO. Para voltar a pasta como era: bash $BACKUPS/bobinas-github.sh desfazer"; } >&2' ERR

  echo "##### 2/5 Pasta vira clone do GitHub ($RAMO, commit ${TESTADO:0:7} conferido acima)"
  if [ -d .git ]; then   # o histórico local antigo está dentro do backup; confere antes de tirar
    tar -tzf "$bk" | grep -c "^$(basename "$DIR")/.git/HEAD$" >/dev/null || { echo "ERRO: o backup não tem o .git"; return 1; }
    rm -rf .git
  fi
  git init -q
  git remote add origin "$REPO"
  git fetch -q origin "$RAMO"
  git checkout -q -f -B "$RAMO" "$TESTADO"
  printf '%s\n' docker-compose.yml "$VERSOES/" dist.novo backend/videos_drone/ atualizar-servidor.sh 'atualizar-servidor.sh.novo.*' >> .git/info/exclude
  printf '%s\n' "$env" > .env && chmod 600 .env
  instalar "$EU" "$DIR/atualizar-servidor.sh"
  git log -1 --format="  %h %ci %s"
  git status --short | head -10

  echo "##### 3/5 Gerando o site a partir do GitHub"
  mkdir -p "$VERSOES"
  construir "$DIR" "$VERSOES/$TS"

  echo "##### 4/5 Publicando (troca o link dist; a pasta antiga fica em $VERSOES/0-original-$TS)"
  publicar "$VERSOES/$TS"
  git rev-parse HEAD > "$SITE_NO_AR"
  if [ "$BACKEND_IGUAL" = 1 ]; then   # se não for igual, o próximo "atualizar" reconstrói o backend
    git rev-parse HEAD > "$DRONE_NO_AR"
    docker inspect -f '{{.Image}}' drone-backend-app > "$IMAGEM_OK"
  fi
  : > "$MARCA_OK"
  trap - ERR

  echo "##### 5/5 Conferência"
  docker compose ps --format '  {{.Name}}: {{.Status}}' 2>/dev/null || true
  http_bobinas
  echo "PRONTO. Atualizar no futuro: bash $DIR/atualizar-servidor.sh atualizar"
  echo "       Voltar só o site: bash $DIR/atualizar-servidor.sh voltar-site   |   Voltar tudo: bash $DIR/atualizar-servidor.sh desfazer"
}

atualizar() {
  cd "$DIR"
  local rt=0 head site_ok drone_ok muda_site=0 muda_drone=0 antes=""
  ja_aplicado || rt=$?
  [ $rt = 1 ] && { echo "Rode primeiro: bash $EU aplicar"; return 1; }
  [ $rt = 2 ] && { echo "O aplicar parou no meio. Rode: bash $BACKUPS/bobinas-github.sh desfazer   e depois o aplicar de novo."; return 1; }

  echo "== 1/4 Baixando do GitHub ($RAMO)"
  git fetch -q origin "$RAMO"
  if git merge-base --is-ancestor HEAD "origin/$RAMO"; then
    git merge -q --ff-only --no-overwrite-ignore "origin/$RAMO" || {
      echo "ERRO: o git recusou atualizar (veja acima). Se o GitHub passou a ter um arquivo com o mesmo nome de um"
      echo "      arquivo só do servidor (docker-compose.yml, atualizar-servidor.sh), mova o do servidor. NÃO use git clean."
      return 1; }
  else
    echo "  O ramo foi reescrito no GitHub (push --force)."
    [ "${FORCAR:-}" = 1 ] || { echo "  Para seguir o GitHub mesmo assim: FORCAR=1 bash $EU atualizar"; return 1; }
    [ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "ERRO: há arquivos mudados na pasta: git -C $DIR status"; return 1; }
    git checkout -q --no-overwrite-ignore -B "$RAMO" "origin/$RAMO"
  fi
  head=$(git rev-parse HEAD)
  site_ok=$(cat "$SITE_NO_AR" 2>/dev/null || echo nenhum)
  drone_ok=$(cat "$DRONE_NO_AR" 2>/dev/null || echo nenhum)
  [ "$site_ok" != "$head" ] && muda_site=1
  if [ "$drone_ok" = nenhum ] || ! git diff --quiet "$drone_ok" "$head" -- backend/; then muda_drone=1; fi
  [ "${FORCAR:-}" = 1 ] && muda_site=1
  [ "${FORCAR_DRONE:-}" = 1 ] && muda_drone=1
  if [ $muda_site = 0 ] && [ $muda_drone = 0 ]; then
    echo "  Já está na última versão: $(git log -1 --format='%h %ci %s')"; return 0
  fi
  git log -1 --format="  agora: %h %ci %s"
  instalar "$DIR/atualizar-servidor.sh" "$BACKUPS/bobinas-github.sh" || true

  echo "== 2/4 Backend do drone: gerando a imagem nova (o container no ar não é mexido ainda)"
  if [ $muda_drone = 1 ]; then
    docker image tag "$(cat "$IMAGEM_OK" 2>/dev/null || docker inspect -f '{{.Image}}' drone-backend-app)" drone-backend:anterior
    docker compose build -q drone || {
      docker image tag drone-backend:anterior drone-backend:v2.4
      echo "ERRO: a imagem do drone não foi gerada; nada foi publicado e o drone no ar continua o mesmo"; return 1; }
  else echo "  sem mudança no backend"; fi

  echo "== 3/4 Site"
  if [ $muda_site = 1 ]; then
    antes=$(readlink dist)
    mkdir -p "$VERSOES"
    construir "$DIR" "$VERSOES/$TS" || {
      [ $muda_drone = 1 ] && docker image tag drone-backend:anterior drone-backend:v2.4
      echo "ERRO: nada foi publicado; site e drone continuam como estavam"; return 1; }
    publicar "$VERSOES/$TS"
  else echo "  sem mudança no site"; fi

  echo "== 4/4 Backend do drone: trocando o container"
  if [ $muda_drone = 1 ]; then
    echo "  esperando o backend novo responder (até 60 s)..."
    if docker compose up -d drone && responde_drone; then
      docker inspect -f '{{.Image}}' drone-backend-app > "$IMAGEM_OK"
      echo "$head" > "$DRONE_NO_AR"
      echo "  BACKEND NOVO OK (a imagem anterior ficou como drone-backend:anterior)"
    else
      echo "  FALHOU: voltando o backend e o site para o que estava (o próximo 'atualizar' tenta de novo)"
      docker image tag drone-backend:anterior drone-backend:v2.4
      docker compose up -d --no-build --force-recreate drone || true
      if [ -n "$antes" ]; then
        juntar_assets "$(readlink -f dist)" "$antes"; trocar_link "$antes"; sed -i '$d' "$HISTORICO"
        echo "  site de volta: dist -> $antes"
      fi
      responde_drone && echo "  backend anterior de volta" || echo "  ERRO: backend não respondeu; veja: docker compose logs drone"
      return 1
    fi
  else echo "  sem mudança no backend"; fi
  [ $muda_site = 1 ] && echo "$head" > "$SITE_NO_AR"
  http_bobinas
}

voltar_site() {
  cd "$DIR"
  [ -L dist ] && [ -f "$HISTORICO" ] || { echo "Não há versões guardadas (rode o aplicar antes)."; return 1; }
  local atual alvo
  atual=$(readlink dist)
  alvo=$(tail -n 2 "$HISTORICO" | head -1)
  [ "$(wc -l < "$HISTORICO")" -ge 2 ] && [ -d "$alvo" ] && [ "$alvo" != "$atual" ] || { echo "Não há versão anterior a $atual."; return 1; }
  conferir_site "$DIR/$alvo" || { echo "A versão $alvo está incompleta; nada mudou."; return 1; }
  juntar_assets "$(readlink -f dist)" "$alvo"
  trocar_link "$alvo"
  sed -i '$d' "$HISTORICO"
  echo "NO AR: dist -> $(readlink dist)   (antes: $atual)"
  echo "Para voltar à versão mais nova depois: FORCAR=1 bash $DIR/atualizar-servidor.sh atualizar"
}

situacao() {
  cd "$DIR"
  local rt=0
  ja_aplicado || rt=$?
  case $rt in 0) echo "Aplicado: sim" ;; 1) echo "Aplicado: não (pasta ainda é a antiga)" ;; 2) echo "Aplicado: PAROU NO MEIO" ;; esac
  git log -1 --format="Commit na pasta: %h %ci %s" 2>/dev/null || true
  [ -L dist ] && echo "Site no ar: dist -> $(readlink dist)" || echo "Site no ar: pasta dist (sem versões)"
  [ -f "$HISTORICO" ] && tail -n 5 "$HISTORICO" | sed 's/^/  publicada: /'
  docker ps --filter name=drone-backend-app --format 'Drone: {{.Names}} {{.Status}} {{.Image}}'
}

desfazer() {
  local bk antes_id
  bk=$(cat "$ULTIMO_BACKUP" 2>/dev/null || true)
  [ -f "$bk" ] || { echo "ERRO: não achei o backup do aplicar ($ULTIMO_BACKUP)"; return 1; }
  echo "Voltando $DIR para o backup $bk"
  cd "$DIR"
  if [ "$(git config --get remote.origin.url 2>/dev/null)" = "$REPO" ]; then
    git ls-files -z | xargs -0 rm -f --        # tira os arquivos que vieram do GitHub
  fi
  rm -rf .git node_modules .env "$VERSOES" atualizar-servidor.sh atualizar-servidor.sh.novo.* dist.novo dist
  find "$DIR" -mindepth 1 -depth -type d -empty -not -path "$DIR/backend/videos_drone*" -delete
  tar -xzf "$bk" -C "$(dirname "$DIR")"
  conferir_site "$DIR/dist"
  git -C "$DIR" log --oneline -1 2>/dev/null || true
  antes_id=$(docker image inspect -f '{{.Id}}' drone-backend:antes-github 2>/dev/null || true)
  if [ -n "$antes_id" ] && [ "$(docker inspect -f '{{.Image}}' drone-backend-app 2>/dev/null)" != "$antes_id" ]; then
    echo "Voltando o backend do drone para a imagem de antes do aplicar"
    docker image tag drone-backend:antes-github drone-backend:v2.4
    docker compose up -d --no-build --force-recreate drone
    responde_drone && echo "  drone OK" || echo "  ERRO: drone não respondeu; veja: docker compose logs drone"
  fi
  http_bobinas
  echo "DESFEITO."
}

case "${1:-}" in
  testar) testar ;;
  aplicar) aplicar ;;
  atualizar) atualizar ;;
  voltar-site) voltar_site ;;
  situacao) situacao ;;
  desfazer) desfazer ;;
  *) sed -n '2,18p' "$EU"; exit 1 ;;
esac; exit $?
