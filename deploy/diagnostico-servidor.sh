#!/usr/bin/env bash
# Diagnóstico do servidor: SÓ LEITURA, não altera nada.
# Uso: bash diagnostico.sh   (gera ~/diagnostico.txt; o sudo pede a senha uma vez)
# Segredos (.env, chaves, tokens) não são impressos; valores parecidos com chave são mascarados.
OUT=~/diagnostico.txt
sudo -v || exit 1
secao() { printf '\n===== %s =====\n' "$1"; }
mascara() { sed -E 's/(key|token|secret|senha|password|apikey|anon)[^[:space:]]*[=:][^[:space:]]+/\1=***/Ig; s/eyJ[A-Za-z0-9._-]{20,}/***JWT***/g'; }
{
secao "SISTEMA"
date; hostnamectl 2>/dev/null | grep -E 'Operating|Kernel|Hardware|Chassis'; uptime
secao "CPU / MEMÓRIA / SWAP"
nproc; free -h; cat /proc/loadavg
secao "DISCO"
df -hT -x tmpfs -x devtmpfs -x overlay -x squashfs
sudo du -sh /var/lib/docker /var/log /home/ti /var/www 2>/dev/null
secao "TEMPERATURA"
sensors 2>/dev/null | grep -E 'Core|Package|temp' | head -8
secao "ATUALIZAÇÕES"
apt list --upgradable 2>/dev/null | tail -n +2 | wc -l | xargs echo "pacotes para atualizar:"
apt list --upgradable 2>/dev/null | grep -i -c security | xargs echo "de segurança:"
systemctl is-enabled unattended-upgrades 2>/dev/null | xargs echo "unattended-upgrades:"
[ -f /var/run/reboot-required ] && echo "REINÍCIO PENDENTE" || echo "sem reinício pendente"
secao "FIREWALL / PORTAS ABERTAS"
sudo ufw status verbose 2>/dev/null | head -20
sudo ss -tlnp | awk 'NR==1 || /LISTEN/' | sed -E 's/users:\(\("([^"]+)".*/\1/'
secao "SSH"
sudo sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|pubkeyauthentication|maxauthtries|x11forwarding) '
wc -l < ~/.ssh/authorized_keys 2>/dev/null | xargs echo "chaves autorizadas (ti):"
awk '{print $NF}' ~/.ssh/authorized_keys 2>/dev/null
systemctl is-active fail2ban 2>/dev/null | xargs echo "fail2ban:"
sudo grep -c 'Failed password' /var/log/auth.log 2>/dev/null | xargs echo "senhas erradas no auth.log:"
secao "USUÁRIOS COM SHELL / SUDO"
awk -F: '$7 ~ /(bash|sh|zsh)$/ {print $1}' /etc/passwd | xargs echo
getent group sudo docker | cut -d: -f1,4
secao "TAILSCALE"
tailscale version 2>/dev/null | head -1; tailscale serve status 2>/dev/null | head -15
secao "NGINX"
nginx -v 2>&1; systemctl is-active nginx
ls -la /etc/nginx/sites-enabled/
sudo nginx -T 2>/dev/null | grep -E '^\s*(listen|server_name|server_tokens|ssl_|client_max_body_size|gzip |limit_req|add_header|location|proxy_pass|root|alias|auth_request)' | mascara
ls -la /etc/nginx/sites-available/ | grep -c bak | xargs echo "arquivos de backup do site:"
secao "DOCKER"
docker version --format 'docker {{.Server.Version}}' 2>/dev/null; docker compose version 2>/dev/null
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
for c in $(docker ps -aq); do docker inspect -f '{{.Name}} restart={{.HostConfig.RestartPolicy.Name}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}sem-healthcheck{{end}} user={{.Config.User}} logdriver={{.HostConfig.LogConfig.Type}} logopts={{.HostConfig.LogConfig.Config}}' "$c"; done
docker system df
docker volume ls
sudo sh -c 'du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -h | tail -5'
cat /etc/docker/daemon.json 2>/dev/null | mascara
secao "PROCESSOS FORA DO DOCKER (PM2 / NODE / PYTHON)"
pm2 list 2>/dev/null | head -20
ps -eo user,pid,%cpu,%mem,etime,cmd --sort=-%mem | grep -Ev 'ps -eo|grep' | head -12 | mascara
systemctl list-units --type=service --state=running --no-pager --no-legend | awk '{print $1}' | xargs echo
secao "APLICAÇÕES (sem conteúdo do .env)"
for d in ~/visionstock ~/rateios ~/acesso-src ~/terceirizados /var/www/*; do
  [ -d "$d" ] || continue
  printf '%s: ' "$d"; (git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null; git -C "$d" log -1 --format='%h %cr' 2>/dev/null; git -C "$d" status --porcelain 2>/dev/null | wc -l | xargs echo "alterações locais:") | xargs echo
  find "$d" -maxdepth 3 -name '.env' -printf '  .env %m %u\n' 2>/dev/null
done
secao "BACKUPS / AGENDAMENTOS"
ls -la ~/backups 2>/dev/null | tail -10
crontab -l 2>/dev/null | grep -v '^#'; sudo crontab -l 2>/dev/null | grep -v '^#'
ls /etc/cron.d /etc/cron.daily 2>/dev/null | xargs echo
systemctl list-timers --no-pager --no-legend 2>/dev/null | awk '{print $NF}' | xargs echo
secao "LOGS (erros recentes)"
sudo journalctl -p err --since "-24h" --no-pager 2>/dev/null | tail -15 | mascara
sudo tail -5 /var/log/nginx/error.log 2>/dev/null | mascara
journalctl --disk-usage 2>/dev/null
secao "TESTE DOS SISTEMAS"
for p in / /acesso/api/health /bobinas/ /imobilizados/ /visionstock/ /rateios/ /terceirizados/; do
  curl -s -o /dev/null -w "$p %{http_code} %{time_total}s\n" "http://127.0.0.1$p"; done
} > "$OUT" 2>&1
echo "Pronto: $OUT ($(wc -l < "$OUT") linhas). Mostre com: cat $OUT"
