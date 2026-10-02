#!/usr/bin/env bash
# Inventário de Bobinas no servidor a partir do GitHub (cópia do Wanderson, ramo melhorias-inventario-v2.4).
# Hoje a pasta /var/www/inventario-bobinas tem só o site pronto (dist) enviado do PC; o código-fonte não está nela.
# Depois do "aplicar", a pasta vira um clone do GitHub e o site é gerado aqui mesmo, num container Node.
#
# Uso:  bash bobinas-github.sh testar       só compara: gera o site do GitHub numa pasta temporária e confere com o
#                                           que está no ar (site e backend do drone). Não muda nada.
#       bash bobinas-github.sh aplicar      backup + pasta vira clone do GitHub + publica o site gerado do GitHub.
#                                           O backend do drone não é mexido (o código dele já é o mesmo do GitHub).
#       bash bobinas-github.sh atualizar    git pull + gera e publica o site; reconstrói o backend do drone só se
#                                           ele mudou no GitHub (volta sozinho para a imagem anterior se falhar).
#       bash bobinas-github.sh voltar-site  volta o site para a versão publicada antes da atual.
#       bash bobinas-github.sh situacao     mostra ramo, commit, versão do site no ar e o container do drone.
#       bash bobinas-github.sh desfazer     volta a pasta inteira para como estava antes do "aplicar".
#
# Variáveis opcionais: BOBINAS_REPO, BOBINAS_RAMO, FORCAR=1 (aplica mesmo se o "testar" achar diferença; no
# "atualizar", gera o site de novo mesmo sem commit novo).
set -Eeuo pipefail
DIR=${BOBINAS_DIR:-/var/www/inventario-bobinas}
REPO=${BOBINAS_REPO:-https://github.com/WandersonGuimaraesOlv/inventario-bobinas.git}
RAMO=${BOBINAS_RAMO:-melhorias-inventario-v2.4}
NODE_IMG=node:22-slim
VERSOES=site-versoes                      # dentro de $DIR; "dist" vira um link para a versão no ar
BACKUPS=~/backups
ULTIMO_BACKUP=$BACKUPS/bobinas-antes-github.ultimo
SITE_NO_AR=$DIR/.git/site-no-ar      # commit do site publicado por último
DRONE_NO_AR=$DIR/.git/drone-no-ar    # commit do backend do drone que está rodando
TS=$(date +%Y%m%d-%H%M%S)
EU=$(readlink -f "${BASH_SOURCE[0]}")

exec 9>/tmp/bobinas-github.lock
flock -n 9 || { echo "Outro bobinas-github.sh já está rodando. Espere ele terminar."; exit 1; }

# ---------------------------------------------------------------------------------------------------------------
# Lê as chaves públicas do Supabase (URL + anon key) de dentro do site que está no ar, para gerar o site novo com
# as mesmas. Elas já vão dentro do site para qualquer navegador; aqui só ficam num .env com permissão 600.
extrair_env() {  # $1 = pasta do site no ar
  local js
  js=$(grep -o 'assets/index-[^"]*\.js' "$1/index.html" | head -1)
  [ -n "$js" ] && [ -f "$1/$js" ] || { echo "ERRO: não achei o JavaScript do site em $1" >&2; return 1; }
  python3 - "$1/$js" <<'PY'
import re, sys
txt = open(sys.argv[1], encoding="utf-8", errors="replace").read()
urls = sorted(set(re.findall(r"https://[a-z0-9]{20}\.supabase\.co", txt)))
chaves = sorted(set(re.findall(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", txt))
                | set(re.findall(r"sb_publishable_[A-Za-z0-9_-]{10,}", txt)))
if len(urls) != 1 or len(chaves) != 1:
    sys.exit(f"ERRO: esperava 1 endereço e 1 chave do Supabase no site, achei {len(urls)} e {len(chaves)}")
print(f"VITE_SUPABASE_URL={urls[0]}")
print(f"VITE_SUPABASE_ANON_KEY={chaves[0]}")
PY
}

# Gera o site com Node dentro de um container (o servidor não precisa ter Node instalado).
construir() {  # $1 = pasta do código (com .env)  $2 = pasta de saída, relativa a $1
  echo "  gerando o site (npm ci + vite build em $NODE_IMG)..."
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
    -e npm_config_update_notifier=false -v "$1:/app" -w /app "$NODE_IMG" \
    sh -c "npm ci --no-audit --no-fund --loglevel=error && npm run build -- --outDir '$2' --emptyOutDir --logLevel warn" \
    >/tmp/bobinas-build.log 2>&1 || { tail -30 /tmp/bobinas-build.log; echo "ERRO: o site não foi gerado (log acima)"; return 1; }
  conferir_site "$1/$2"
}

# O index.html tem que existir e apontar para arquivos que existem.
conferir_site() {  # $1 = pasta do site
  local ref
  [ -f "$1/index.html" ] || { echo "ERRO: $1/index.html não existe"; return 1; }
  for ref in $(grep -o '/bobinas/assets/[^"]*' "$1/index.html"); do
    [ -f "$1/${ref#/bobinas/}" ] || { echo "ERRO: $1 aponta para ${ref} que não existe"; return 1; }
  done
}

# Compara dois sites ignorando a quebra de linha do Windows (o site no ar foi gerado num PC Windows).
comparar_sites() {  # $1 = novo  $2 = no ar.  Saída 0 = iguais
  python3 - "$1" "$2" <<'PY'
import os, re, sys
novo, noar = sys.argv[1:3]
def ler(p):
    b = open(p, "rb").read()
    if not p.endswith((".html", ".js", ".css", ".json", ".txt", ".svg", ".webmanifest")):
        return b
    return b.replace(b"\r", b"").replace(b"\\r\\n", b"\\n")
def refs(d):
    html = open(os.path.join(d, "index.html"), encoding="utf-8").read()
    return {os.path.splitext(r)[1]: r for r in re.findall(r"/bobinas/(assets/[^\"]+\.(?:js|css))", html)}
def sem_hash(b):
    return re.sub(rb"(assets/[\w.-]+?)-[\w-]{8}\.(js|css|png|svg|jpg|webp)", rb"\1.\2", b)
diferentes = []
pares = [("index.html", "index.html")]
rn, ra = refs(novo), refs(noar)
for ext in sorted(set(rn) | set(ra)):
    if ext not in rn or ext not in ra:
        diferentes.append(f"{ext}: só existe num dos dois"); continue
    pares.append((rn[ext], ra[ext]))
for nome in sorted(os.listdir(novo)):
    if os.path.isfile(os.path.join(novo, nome)) and nome != "index.html":
        pares.append((nome, nome))
for a in sorted(os.listdir(os.path.join(novo, "assets"))):
    if not a.endswith((".js", ".css")):
        pares.append(("assets/" + a, "assets/" + a))
for pn, pa in pares:
    fn, fa = os.path.join(novo, pn), os.path.join(noar, pa)
    if not os.path.isfile(fa):
        diferentes.append(f"{pa}: não existe no site que está no ar"); continue
    bn, ba = ler(fn), ler(fa)
    if pn == "index.html":
        bn, ba = sem_hash(bn), sem_hash(ba)
    if bn == ba:
        print(f"  igual      {pn}" + ("" if pn == pa else f"  (no ar: {pa})"))
        continue
    i = next((k for k in range(min(len(bn), len(ba))) if bn[k] != ba[k]), min(len(bn), len(ba)))
    diferentes.append(f"{pn}: {len(bn)} x {len(ba)} bytes, primeira diferença no byte {i}\n"
                      f"      GitHub: {bn[max(0, i - 60):i + 60]!r}\n      no ar:  {ba[max(0, i - 60):i + 60]!r}")
for d in diferentes:
    print("  DIFERENTE  " + d)
sys.exit(1 if diferentes else 0)
PY
}

comparar_backend() {  # $1 = pasta backend do GitHub.  Compara com a pasta do servidor e com o container no ar.
  local f r=0
  for f in main.py requirements.txt Dockerfile; do
    if cmp -s <(tr -d '\r' < "$1/$f") <(tr -d '\r' < "$DIR/backend/$f" 2>/dev/null); then echo "  igual      backend/$f"
    else echo "  DIFERENTE  backend/$f"; r=1; fi
  done
  if cmp -s <(tr -d '\r' < "$1/main.py") <(docker exec drone-backend-app cat /app/main.py 2>/dev/null | tr -d '\r'); then
    echo "  igual      main.py dentro do container drone-backend-app"
  else echo "  DIFERENTE  main.py dentro do container drone-backend-app"; r=1; fi
  return $r
}

responde_drone() { for _ in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:8000/ && return 0; sleep 3; done; return 1; }

# Publica uma versão do site: copia os arquivos antigos de assets (abas abertas continuam funcionando) e troca o
# link "dist" de uma vez só (o Nginx continua servindo /var/www/inventario-bobinas/dist/ sem mudar nada nele).
publicar() {  # $1 = pasta da versão, relativa a $DIR
  cd "$DIR"
  local atual f v
  atual=$(readlink -f dist)
  for f in "$atual"/assets/*; do
    [ -e "$1/assets/${f##*/}" ] || cp -p "$f" "$1/assets/"
  done
  ln -sfn "$1" dist.novo
  if [ -d dist ] && [ ! -L dist ]; then
    # primeira vez: troca a pasta dist real pelo link numa operação só; a pasta antiga vira a versão "0-original"
    if trocar_de_lugar dist.novo dist; then mv dist.novo "$VERSOES/0-original-$TS"
    else mv dist "$VERSOES/0-original-$TS" && mv -T dist.novo dist; fi
  else
    mv -Tf dist.novo dist
  fi
  conferir_site "$DIR/dist"
  echo "  NO AR: dist -> $(readlink dist)"
  # guarda as 3 versões geradas mais novas (e a original)
  for v in $(ls -1d "$VERSOES"/2*/ 2>/dev/null | sed 's:/$::' | sort -r | tail -n +4); do
    [ "$(readlink -f "$v")" = "$(readlink -f dist)" ] || rm -rf "$v"
  done
}

# Troca dois caminhos de lugar numa operação só do Linux (renameat2 RENAME_EXCHANGE).
trocar_de_lugar() {
  python3 - "$1" "$2" <<'PY2'
import ctypes, sys
libc = ctypes.CDLL(None, use_errno=True)
sys.exit(0 if libc.renameat2(-100, sys.argv[1].encode(), -100, sys.argv[2].encode(), 2) == 0 else 1)
PY2
}

http_bobinas() { curl -s -o /dev/null -w "  /bobinas/ %{http_code} (302 = pede login, normal)\n" http://127.0.0.1/bobinas/; }

# ---------------------------------------------------------------------------------------------------------------
testar() {
  local tmp r=0
  tmp=$(mktemp -d /tmp/bobinas-teste.XXXXXX)
  echo "== 1/3 Baixando o ramo $RAMO de $REPO"
  git clone -q --depth 1 -b "$RAMO" "$REPO" "$tmp/src"
  git -C "$tmp/src" log -1 --format="  %h %ci %s"
  echo "== 2/3 Gerando o site do GitHub com as mesmas chaves do site no ar"
  extrair_env "$DIR/dist" > "$tmp/src/.env"
  construir "$tmp/src" site
  echo "== 3/3 Comparando com o que está no ar"
  comparar_sites "$tmp/src/site" "$DIR/dist" || r=1
  if comparar_backend "$tmp/src/backend"; then BACKEND_IGUAL=1; else BACKEND_IGUAL=0; r=1; fi
  rm -rf "$tmp"
  if [ $r = 0 ]; then echo "RESULTADO: IGUAL. O GitHub tem exatamente o que está no ar. Pode rodar: bash $EU aplicar"
  else echo "RESULTADO: HÁ DIFERENÇAS (lista acima). Nada foi mudado."; fi
  return $r
}

aplicar() {
  cd "$DIR"
  if [ "$(git config --get remote.origin.url 2>/dev/null)" = "$REPO" ]; then
    echo "Já aplicado (a pasta já é clone de $REPO). Para atualizar: bash $DIR/atualizar-servidor.sh atualizar"; return 0
  fi
  echo "##### Conferência antes de mexer"
  testar || [ "${FORCAR:-}" = 1 ] || { echo "Parei sem mudar nada. Para aplicar mesmo assim: FORCAR=1 bash $EU aplicar"; return 1; }

  echo "##### 1/5 Backup da pasta (sem os vídeos do drone)"
  mkdir -p "$BACKUPS"
  local bk=$BACKUPS/bobinas-antes-github-$TS.tgz env
  tar -czf "$bk" --exclude='backend/videos_drone' -C "$(dirname "$DIR")" "$(basename "$DIR")"
  echo "$bk" > "$ULTIMO_BACKUP"
  ls -lh "$bk"
  env=$(extrair_env "$DIR/dist")
  trap 'echo; echo "ERRO na linha $LINENO. Para voltar a pasta como era: bash $BACKUPS/bobinas-github.sh desfazer"' ERR
  cp "$EU" "$BACKUPS/bobinas-github.sh"

  echo "##### 2/5 Pasta vira clone do GitHub ($RAMO)"
  # o histórico local antigo (.git) está dentro do backup; confere antes de tirar
  if [ -d .git ]; then
    tar -tzf "$bk" | grep -c "^$(basename "$DIR")/.git/HEAD$" >/dev/null || { echo "ERRO: o backup não tem o .git"; return 1; }
    rm -rf .git
  fi
  git init -q
  git remote add origin "$REPO"
  git fetch -q origin "$RAMO"
  git checkout -q -f -B "$RAMO" "origin/$RAMO"
  printf '%s\n' docker-compose.yml "$VERSOES/" dist.novo backend/videos_drone/ atualizar-servidor.sh >> .git/info/exclude
  printf '%s\n' "$env" > .env && chmod 600 .env
  cp "$EU" atualizar-servidor.sh
  git log -1 --format="  %h %ci %s"
  git status --short | head -10

  echo "##### 3/5 Gerando o site a partir do GitHub"
  mkdir -p "$VERSOES"
  construir "$DIR" "$VERSOES/$TS"

  echo "##### 4/5 Publicando (troca o link dist; a pasta antiga fica em $VERSOES/0-original-$TS)"
  publicar "$VERSOES/$TS"
  git rev-parse HEAD > "$SITE_NO_AR"
  # o "testar" conferiu se o backend no ar é o deste commit; se não for, o próximo "atualizar" reconstrói ele
  [ "${BACKEND_IGUAL:-0}" = 1 ] && git rev-parse HEAD > "$DRONE_NO_AR"

  echo "##### 5/5 Conferência"
  trap - ERR
  docker compose ps --format '  {{.Name}}: {{.Status}}' 2>/dev/null || true
  http_bobinas
  echo "PRONTO. Atualizar no futuro: bash $DIR/atualizar-servidor.sh atualizar"
  echo "       Voltar só o site: bash $DIR/atualizar-servidor.sh voltar-site   |   Voltar tudo: bash $DIR/atualizar-servidor.sh desfazer"
}

atualizar() {
  cd "$DIR"
  [ "$(git config --get remote.origin.url 2>/dev/null)" = "$REPO" ] || { echo "Rode primeiro: bash $EU aplicar"; return 1; }
  local site_ok drone_ok head muda_site=0 muda_drone=0
  echo "== 1/3 Baixando do GitHub ($RAMO)"
  git fetch -q origin "$RAMO"
  git merge -q --ff-only "origin/$RAMO" || { echo "ERRO: há mudanças locais na pasta; veja com: git -C $DIR status"; return 1; }
  head=$(git rev-parse HEAD)
  site_ok=$(cat "$SITE_NO_AR" 2>/dev/null || echo nenhum)       # commit do site publicado por último
  drone_ok=$(cat "$DRONE_NO_AR" 2>/dev/null || echo nenhum)     # commit do backend que está rodando
  [ "$site_ok" != "$head" ] && muda_site=1
  { [ "$drone_ok" = nenhum ] || ! git diff --quiet "$drone_ok" "$head" -- backend/; } && muda_drone=1
  [ "${FORCAR:-}" = 1 ] && muda_site=1 && muda_drone=1
  if [ $muda_site = 0 ] && [ $muda_drone = 0 ]; then
    echo "  Já está na última versão: $(git log -1 --format='%h %ci %s')"; return 0
  fi
  git log -1 --format="  agora: %h %ci %s"
  cp atualizar-servidor.sh "$BACKUPS/bobinas-github.sh" 2>/dev/null || true

  echo "== 2/3 Site"
  if [ $muda_site = 1 ]; then
    mkdir -p "$VERSOES"
    construir "$DIR" "$VERSOES/$TS"
    publicar "$VERSOES/$TS"
    echo "$head" > "$SITE_NO_AR"
  else echo "  sem mudança no site"; fi

  echo "== 3/3 Backend do drone"
  if [ $muda_drone = 0 ]; then
    echo "  sem mudança no backend; container continua o mesmo"
  else
    docker image tag drone-backend:v2.4 drone-backend:anterior
    if docker compose build -q drone && docker compose up -d drone && responde_drone; then
      echo "$head" > "$DRONE_NO_AR"
      echo "  BACKEND NOVO OK (a imagem anterior ficou como drone-backend:anterior)"
    else
      echo "  FALHOU: voltando a imagem anterior (o próximo 'atualizar' tenta de novo)"
      docker image tag drone-backend:anterior drone-backend:v2.4
      docker compose up -d --no-build --force-recreate drone
      responde_drone && echo "  backend anterior de volta" || echo "  ERRO: backend não respondeu; veja: docker compose logs drone"
      return 1
    fi
  fi
  http_bobinas
}

voltar_site() {
  cd "$DIR"
  [ -L dist ] || { echo "Não há versões guardadas (rode o aplicar antes)."; return 1; }
  local atual anterior
  atual=$(readlink dist); atual=${atual%/}
  anterior=$(ls -1d "$VERSOES"/*/ | sed 's:/$::' | sort | grep -B1 -xF "$atual" | head -1)
  [ -n "$anterior" ] && [ "$anterior" != "$atual" ] || { echo "Não há versão anterior a $atual."; return 1; }
  ln -sfn "$anterior" dist.novo && mv -Tf dist.novo dist
  conferir_site "$DIR/dist"
  echo "NO AR: dist -> $(readlink dist)   (antes: $atual)"
}

situacao() {
  cd "$DIR"
  echo "Repositório: $(git config --get remote.origin.url 2>/dev/null || echo 'não é clone do GitHub')"
  git log -1 --format="Commit no servidor: %h %ci %s" 2>/dev/null || true
  [ -L dist ] && echo "Site no ar: dist -> $(readlink dist)" || echo "Site no ar: pasta dist (sem versões)"
  [ -d "$VERSOES" ] && ls -1 "$VERSOES" | sed 's/^/  versão guardada: /'
  docker ps --filter name=drone-backend-app --format 'Drone: {{.Names}} {{.Status}} {{.Image}}'
}

desfazer() {
  local bk
  bk=$(cat "$ULTIMO_BACKUP" 2>/dev/null || true)
  [ -f "$bk" ] || { echo "ERRO: não achei o backup do aplicar ($ULTIMO_BACKUP)"; return 1; }
  echo "Voltando $DIR para o backup $bk"
  cd "$DIR"
  if [ "$(git config --get remote.origin.url 2>/dev/null)" = "$REPO" ]; then
    git ls-files -z | xargs -0 rm -f --        # tira os arquivos que vieram do GitHub
  fi
  rm -rf .git node_modules .env "$VERSOES" atualizar-servidor.sh dist.novo
  rm -rf dist
  tar -xzf "$bk" -C "$(dirname "$DIR")"
  find "$DIR" -mindepth 1 -depth -type d -empty -not -path "$DIR/backend/videos_drone*" -delete
  conferir_site "$DIR/dist"
  git -C "$DIR" log --oneline -1
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
  *) sed -n '2,20p' "$EU"; exit 1 ;;
esac
