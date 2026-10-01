#!/usr/bin/env bash
# Correções de segurança do servidor, por etapa. Cada etapa faz backup e volta sozinha se der erro.
#
#   bash melhorias-servidor.sh fechar        # /api/ e /drone-api/ com login, porta 3001 só local, .env 600
#   bash melhorias-servidor.sh fail2ban      # bloqueia IPs que erram a senha do SSH várias vezes
#   bash melhorias-servidor.sh backup        # backup diário às 2h em ~/backups (guarda 14 dias)
#   bash melhorias-servidor.sh funnel-off    # tira o site da internet aberta (fica só na rede Tailscale)
#   bash melhorias-servidor.sh funnel-on     # volta o Funnel (desfaz a etapa anterior)
set -euo pipefail

SITE=${SITE:-/etc/nginx/sites-available/imobilizados}

recarregar_ou_voltar() {  # $1 = backup
  if sudo nginx -t && sudo systemctl reload nginx; then return 0; fi
  sudo cp "$1" "$SITE"; sudo systemctl reload nginx || true
  echo "FALHOU: Nginx restaurado do backup $1"; exit 1
}

# Insere auth_request logo depois da linha "location <caminho> {" (se ainda não tiver)
proteger_location() {  # $1 = caminho exato (ex.: /api/)  $2 = sistema
  awk -v loc="$1" -v s="$2" '
    { print }
    $1 == "location" && $2 == loc && $3 == "{" {
      getline prox
      if (prox !~ /auth_request/) {
        print "        auth_request /_acesso/" s ";"
        print "        error_page 401 = @acesso_entrar;"
        print "        error_page 403 = @acesso_negado;"
      }
      print prox
    }' "$3" > "$3.novo" && mv "$3.novo" "$3"
}

fechar() {
  echo "== 1/3 Nginx: login em /api/ (Imobilizados) e /drone-api/ (Bobinas)"
  grep -q "location ^~ /acesso/" "$SITE" || { echo "ERRO: Portal de Acesso não instalado"; exit 1; }
  sudo cp "$SITE" "$SITE.bak-melhorias"
  cp "$SITE.bak-melhorias" /tmp/site-melhorias.conf
  proteger_location /api/ imobilizados /tmp/site-melhorias.conf
  proteger_location /drone-api/ bobinas /tmp/site-melhorias.conf
  sudo cp /tmp/site-melhorias.conf "$SITE"
  recarregar_ou_voltar "$SITE.bak-melhorias"
  for s in imobilizados bobinas; do
    echo "  $s: $(grep -c "auth_request /_acesso/$s;" "$SITE") bloco(s) com login"
  done
  curl -s -o /dev/null -w "  /api/ sem login: %{http_code} (esperado 302)\n" http://127.0.0.1/api/
  curl -s -o /dev/null -w "  /drone-api/ sem login: %{http_code} (esperado 302)\n" http://127.0.0.1/drone-api/

  echo "== 2/3 Imobilizados: porta 3001 só para o próprio servidor"
  local cont dir arq
  cont=$(docker ps --format '{{.Names}}' | grep -E 'imobilizados' | head -1)
  dir=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$cont" 2>/dev/null || true)
  arq=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$cont" 2>/dev/null | cut -d, -f1 || true)
  if [ -z "$arq" ] || [ ! -f "$arq" ]; then
    echo "  AVISO: não achei o docker-compose do Imobilizados (container $cont). Porta 3001 continua aberta; me mande: docker inspect $cont | grep -i compose"
  elif grep -qE '127\.0\.0\.1:3001:3001' "$arq"; then
    echo "  já estava restrita"
  else
    cp "$arq" "$arq.bak-melhorias"
    sed -i -E 's/(["'"'"' -])(0\.0\.0\.0:)?3001:3001/\1127.0.0.1:3001:3001/' "$arq"
    if grep -q '127.0.0.1:3001:3001' "$arq" && (cd "$dir" && docker compose -f "$arq" up -d); then
      for _ in $(seq 1 20); do curl -fs -o /dev/null http://127.0.0.1:3001/ && break; sleep 2; done
      if curl -fs -o /dev/null http://127.0.0.1:3001/ && ! sudo ss -tln | grep -qE '0\.0\.0\.0:3001|\[::\]:3001'; then
        echo "  PORTA OK: 3001 só em 127.0.0.1 ($arq, backup .bak-melhorias)"
      else
        echo "  FALHOU: voltando o compose"; cp "$arq.bak-melhorias" "$arq"; (cd "$dir" && docker compose -f "$arq" up -d); exit 1
      fi
    else
      echo "  FALHOU ao alterar $arq: restaurado"; cp "$arq.bak-melhorias" "$arq"; (cd "$dir" && docker compose -f "$arq" up -d) || true
    fi
  fi

  echo "== 3/3 Permissão dos .env"
  for f in /var/www/imobilizados/.env ~/visionstock/.env ~/rateios/.env ~/terceirizados/.env ~/acesso-src/portal-acesso/.env; do
    [ -f "$f" ] && chmod 600 "$f" && echo "  600 $f"
  done
  curl -s -o /dev/null -w "Conferência: /imobilizados/ %{http_code} (302 = pede login)\n" http://127.0.0.1/imobilizados/
}

fail2ban() {
  echo "== fail2ban para o SSH"
  sudo apt-get install -y -q fail2ban >/dev/null
  printf '[sshd]\nenabled = true\nmaxretry = 5\nfindtime = 10m\nbantime = 1h\nignoreip = 127.0.0.1/8 ::1 100.64.0.0/10\n' \
    | sudo tee /etc/fail2ban/jail.d/sshd-local.conf >/dev/null
  sudo systemctl enable --now fail2ban >/dev/null && sudo systemctl restart fail2ban
  sleep 2; sudo fail2ban-client status sshd | head -4 && echo "FAIL2BAN OK (IPs do Tailscale nunca são bloqueados)"
}

backup() {
  echo "== Backup diário"
  sudo tee /usr/local/bin/backup-servidor >/dev/null <<'SCRIPT'
#!/usr/bin/env bash
# Backup diário: configurações, .env, portal, código local e banco do Portal de Acesso. Guarda 14 dias.
set -uo pipefail
DESTINO=/home/ti/backups
DATA=$(date +%Y%m%d-%H%M)
mkdir -p "$DESTINO" && chmod 700 "$DESTINO"
docker run --rm -v acesso_acesso-dados:/dados -v "$DESTINO":/saida alpine \
  sh -c "cp /dados/acesso.db /saida/acesso-$DATA.db" 2>/dev/null
tar -czf "$DESTINO/servidor-$DATA.tgz" --ignore-failed-read \
  --exclude='node_modules' --exclude='dist' --exclude='.git' \
  /etc/nginx /var/www/portal /var/www/imobilizados \
  /home/ti/terceirizados /home/ti/visionstock/.env /home/ti/rateios/.env \
  /home/ti/acesso-src/portal-acesso/.env 2>/dev/null
[ -f "$DESTINO/acesso-$DATA.db" ] && gzip -f "$DESTINO/acesso-$DATA.db"
chown -R ti:ti "$DESTINO"; chmod 600 "$DESTINO"/*
find "$DESTINO" -name 'servidor-*.tgz' -mtime +14 -delete
find "$DESTINO" -name 'acesso-*.db.gz' -mtime +14 -delete
echo "$(date) backup ok: $(du -sh "$DESTINO/servidor-$DATA.tgz" | cut -f1)" >> "$DESTINO/backup.log"
SCRIPT
  sudo chmod 755 /usr/local/bin/backup-servidor
  echo "0 2 * * * root /usr/local/bin/backup-servidor" | sudo tee /etc/cron.d/backup-servidor >/dev/null
  sudo /usr/local/bin/backup-servidor
  ls -lh ~/backups | tail -4
  tail -1 ~/backups/backup.log && echo "BACKUP OK: roda todo dia às 2h"
  echo "Lembrete: copie ~/backups para outra máquina (o disco deste servidor é o único lugar onde está)."
}

funnel_off() {
  echo "== Tirando o site da internet aberta (fica só na rede Tailscale)"
  sudo tailscale serve status > ~/tailscale-serve-antes.txt 2>&1 || true
  sudo tailscale funnel --https=443 off || true
  sudo tailscale serve --bg --https=443 http://127.0.0.1:80
  sleep 2; sudo tailscale serve status
  if sudo tailscale serve status | grep -qi "funnel on"; then echo "ERRO: Funnel continua ligado"; exit 1; fi
  local nome; nome=$(tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
  if curl -fs -o /dev/null "https://$nome/acesso/api/health"; then echo "FUNNEL OFF: https://$nome continua funcionando para quem está no Tailscale"
  else echo "AVISO: https://$nome não respondeu; voltando o Funnel"; funnel_on; fi
}

funnel_on() {
  sudo tailscale funnel --bg --https=443 http://127.0.0.1:80 && sudo tailscale serve status && echo "FUNNEL ON"
}

case "${1:-}" in
  fechar) fechar ;;
  fail2ban) fail2ban ;;
  backup) backup ;;
  funnel-off) funnel_off ;;
  funnel-on) funnel_on ;;
  *) sed -n '2,9p' "$0"; exit 1 ;;
esac
