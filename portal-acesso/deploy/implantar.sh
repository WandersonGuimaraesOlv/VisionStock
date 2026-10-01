#!/usr/bin/env bash
# Implanta o Portal de Acesso (login único + permissões por sistema) no servidor.
#
#   bash implantar.sh instalar      # serviço + /acesso/ no Nginx + barra no portal (não protege nada ainda)
#   bash implantar.sh criar-admin   # cria o primeiro administrador (pede usuário e senha)
#   bash implantar.sh proteger      # liga a checagem do Nginx nos sistemas (em modo observar ninguém é barrado)
#   bash implantar.sh bloquear      # passa a barrar quem não tem permissão
#   bash implantar.sh observar      # volta a só observar (botão de emergência: libera todo mundo)
#   bash implantar.sh desfazer      # tira a checagem do Nginx e a barra do portal (restaura os backups)
#   bash implantar.sh status
set -euo pipefail

REPO=${REPO:-https://github.com/WandersonGuimaraesOlv/VisionStock.git}
RAMO=${RAMO:-master}
FONTE=${FONTE:-$HOME/acesso-src}
DIR="$FONTE/portal-acesso"
SITE=${SITE:-/etc/nginx/sites-available/imobilizados}
PORTAL=${PORTAL:-/var/www/portal/index.html}
SISTEMAS=${SISTEMAS:-"bobinas imobilizados visionstock rateios terceirizados"}
PORTA=${ACESSO_PORTA:-8093}
SUDO=${SUDO-sudo}
NGINX_TESTE=${NGINX_TESTE:-"$SUDO nginx -t"}
NGINX_RECARREGA=${NGINX_RECARREGA:-"$SUDO systemctl reload nginx"}

recarregar_nginx_ou_voltar() {  # $1 = backup
  if $NGINX_TESTE && $NGINX_RECARREGA; then return 0; fi
  $SUDO cp "$1" "$SITE"; $NGINX_RECARREGA || true
  echo "FALHOU: Nginx restaurado do backup $1"; exit 1
}

servico() {
  echo "== Código (ramo $RAMO)"
  if [ -d "$FONTE/.git" ]; then git -C "$FONTE" fetch -q origin "$RAMO" && git -C "$FONTE" checkout -q -B "$RAMO" "origin/$RAMO"
  else git clone -q --branch "$RAMO" "$REPO" "$FONTE"; fi
  cd "$DIR"
  [ -f .env ] || cp .env.example .env
  echo "== Container"
  docker compose up -d --build
  for _ in $(seq 1 30); do curl -fs "http://127.0.0.1:$PORTA/acesso/api/health" >/dev/null && break; sleep 2; done
  curl -fs "http://127.0.0.1:$PORTA/acesso/api/health" && echo "  SERVIÇO OK" || { docker compose logs --tail=40; echo "ERRO: serviço não respondeu"; exit 1; }
}

nginx_base() {
  echo "== Nginx: /acesso/ e consulta interna"
  if grep -q "location ^~ /acesso/" "$SITE"; then echo "  já existe"; return; fi
  grep -q "location /visionstock/" "$SITE" || { echo "ERRO: não achei 'location /visionstock/' em $SITE"; exit 1; }
  $SUDO cp "$SITE" "$SITE.bak-acesso"
  cat > /tmp/acesso-nginx.conf <<NGX
    # --- Portal de Acesso (início) ---
    location ^~ /acesso/ {
        proxy_pass http://127.0.0.1:$PORTA;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location ~ ^/_acesso/([a-z0-9-]+)\$ {
        internal;
        proxy_pass http://127.0.0.1:$PORTA/acesso/api/verificar/\$1;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI \$request_uri;
        proxy_set_header X-Real-IP \$remote_addr;
        error_page 502 504 = @acesso_fora_do_ar;
    }
    # Se o serviço de acesso cair: 200 libera os sistemas (modo observar); 503 segura tudo (modo bloquear)
    location @acesso_fora_do_ar { return 200; }
    location @acesso_entrar { absolute_redirect off; return 302 /acesso/entrar?volta=\$request_uri; }
    location @acesso_negado { absolute_redirect off; return 302 /acesso/sem-acesso; }
    # --- Portal de Acesso (fim) ---

NGX
  awk -v bloco=/tmp/acesso-nginx.conf '!f && /location \/visionstock\//{while((getline l < bloco)>0) print l; f=1} {print}' \
    "$SITE.bak-acesso" | $SUDO tee "$SITE" >/dev/null
  grep -q "location ^~ /acesso/" "$SITE" || { $SUDO cp "$SITE.bak-acesso" "$SITE"; echo "ERRO: bloco não inserido"; exit 1; }
  recarregar_nginx_ou_voltar "$SITE.bak-acesso"
  curl -fs http://127.0.0.1/acesso/api/health >/dev/null && echo "  NGINX OK" || echo "  AVISO: /acesso/ não respondeu pelo Nginx"
}

portal() {
  echo "== Portal: barra de usuário e cards por permissão"
  if grep -q "/acesso/portal.js" "$PORTAL"; then echo "  já existe"; return; fi
  grep -q "</body>" "$PORTAL" || { echo "  AVISO: </body> não encontrado; portal não alterado"; return; }
  $SUDO cp "$PORTAL" "$PORTAL.bak-acesso"
  sed 's#</body>#  <script src="/acesso/portal.js" defer></script>\n</body>#' "$PORTAL.bak-acesso" > /tmp/portal-acesso.html
  grep -q "/acesso/portal.js" /tmp/portal-acesso.html && $SUDO cp /tmp/portal-acesso.html "$PORTAL" && echo "  PORTAL OK" \
    || echo "  AVISO: portal não alterado"
}

proteger() {
  echo "== Nginx: checagem de acesso em cada sistema"
  grep -q "location ^~ /acesso/" "$SITE" || { echo "ERRO: rode antes: bash implantar.sh instalar"; exit 1; }
  $SUDO cp "$SITE" "$SITE.bak-acesso-proteger"
  local tmp=/tmp/acesso-site.conf
  cp "$SITE.bak-acesso-proteger" "$tmp"
  for s in $SISTEMAS; do
    # Toda location que começa por /<sistema> (menos o "= /<sistema>" que só redireciona) ganha as 3 linhas
    awk -v s="$s" '
      { print }
      $0 ~ "^[ \t]*location[ \t]+(\\^~[ \t]+)?/" s "(/[^ \t{]*)?[ \t]*\\{[ \t]*$" {
        getline prox
        if (prox !~ /auth_request/) {
          print "        auth_request /_acesso/" s ";"
          print "        error_page 401 = @acesso_entrar;"
          print "        error_page 403 = @acesso_negado;"
        }
        print prox
      }' "$tmp" > "$tmp.novo" && mv "$tmp.novo" "$tmp"
    n=$(grep -c "auth_request /_acesso/$s;" "$tmp" || true)
    if [ "$n" -gt 0 ]; then echo "  $s: protegido ($n bloco(s))"; else echo "  $s: NÃO ENCONTRADO (location /$s/ não existe neste site)"; fi
  done
  $SUDO cp "$tmp" "$SITE"
  recarregar_nginx_ou_voltar "$SITE.bak-acesso-proteger"
  echo "  PROTEÇÃO OK (backup em $SITE.bak-acesso-proteger)"
}

modo() {  # $1 = observar | bloquear
  cd "$DIR"
  if grep -q '^ACESSO_MODO=' .env; then sed -i "s/^ACESSO_MODO=.*/ACESSO_MODO=$1/" .env; else echo "ACESSO_MODO=$1" >> .env; fi
  docker compose up -d
  for _ in $(seq 1 15); do curl -fs "http://127.0.0.1:$PORTA/acesso/api/health" | grep -q "\"$1\"" && break; sleep 2; done
  curl -fs "http://127.0.0.1:$PORTA/acesso/api/health" | grep -q "\"$1\"" || { echo "ERRO: modo não mudou"; exit 1; }
  fora_do_ar "$1"
  echo "MODO OK: $1"
}

fora_do_ar() {  # Serviço fora do ar: observar libera os sistemas (200); bloquear segura (503)
  local codigo=200
  if [ "$1" = bloquear ]; then codigo=503; fi
  grep -q "location @acesso_fora_do_ar" "$SITE" || return 0
  $SUDO cp "$SITE" "$SITE.bak-acesso-modo"
  $SUDO sed -i -E "s/(location @acesso_fora_do_ar \{ return )[0-9]+;/\1$codigo;/" "$SITE"
  recarregar_nginx_ou_voltar "$SITE.bak-acesso-modo"
}

desfazer() {
  echo "== Tirando a checagem do Nginx"
  $SUDO cp "$SITE" "$SITE.antes-de-desfazer"
  sed -e '/auth_request \/_acesso\//d' -e '/error_page 40[13] = @acesso_/d' "$SITE.antes-de-desfazer" \
    | awk '/# --- Portal de Acesso \(início\) ---/{f=1} !f{print} /# --- Portal de Acesso \(fim\) ---/{f=0; getline}' \
    | $SUDO tee "$SITE" >/dev/null
  recarregar_nginx_ou_voltar "$SITE.antes-de-desfazer"
  if grep -q "/acesso/portal.js" "$PORTAL"; then
    $SUDO sed -i '\#/acesso/portal.js#d' "$PORTAL"
  fi
  grep -q "_acesso" "$SITE" && echo "AVISO: ainda há linhas de acesso em $SITE" || echo "DESFEITO: sistemas abertos como antes"
}

status() {
  curl -s "http://127.0.0.1:$PORTA/acesso/api/health"; echo
  for s in $SISTEMAS; do printf '  %-14s %s\n' "$s" "$(grep -c "auth_request /_acesso/$s;" "$SITE" || true) bloco(s) protegido(s)"; done
  for s in $SISTEMAS; do curl -s -o /dev/null -w "  /$s/: %{http_code}\n" "http://127.0.0.1/$s/"; done
}

case "${1:-}" in
  instalar) servico; nginx_base; portal; echo "Próximo passo: bash $0 criar-admin" ;;
  criar-admin) cd "$DIR" && docker compose exec acesso python -m app.cli criar-admin ;;
  proteger) proteger; status ;;
  bloquear) modo bloquear; status ;;
  observar) modo observar ;;
  desfazer) desfazer ;;
  status) status ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
