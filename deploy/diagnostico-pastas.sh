#!/usr/bin/env bash
# Revisão das pastas dos sistemas no servidor: SÓ LEITURA, não altera nada.
# Uso: bash diagnostico-pastas.sh   (gera ~/pastas.txt; o sudo pede a senha uma vez)
OUT=~/pastas.txt
sudo -v || exit 1
secao() { printf '\n===== %s =====\n' "$1"; }
{
secao "TAMANHO DAS PASTAS PRINCIPAIS"
sudo du -xsh /home/ti/* /var/www/* /opt/* /srv/* /root 2>/dev/null | sort -h
secao "ARQUIVOS SOLTOS EM /home/ti"
find /home/ti -maxdepth 1 -type f ! -name '.*' -printf '%TY-%Tm-%Td %10s  %p\n' | sort

secao "CADA PASTA DE SISTEMA: git, ramo, origem, alterações, compose"
for d in /home/ti/*/ /var/www/*/ /opt/*/ /srv/*/; do
  [ -d "$d" ] || continue
  d=${d%/}
  printf '\n%s\n' "$d"
  if git -C "$d" rev-parse --git-dir >/dev/null 2>&1; then
    printf '  git: %s  %s  origem=%s\n' "$(git -C "$d" rev-parse --abbrev-ref HEAD)" "$(git -C "$d" log -1 --format='%h %cr')" \
      "$(git -C "$d" remote get-url origin 2>/dev/null | sed -E 's#https://[^@]*@#https://#')"
    git -C "$d" status --porcelain 2>/dev/null | head -8 | sed 's/^/  alterado: /'
  else
    echo "  sem git"
  fi
  find "$d" -maxdepth 3 \( -name 'docker-compose*.yml' -o -name 'compose*.yml' -o -name 'Dockerfile' -o -name 'ecosystem.config.*' \) \
    -not -path '*/node_modules/*' -printf '  arquivo: %P\n' 2>/dev/null
done

secao "QUAL PASTA CADA CONTAINER USA"
for c in $(docker ps -a --format '{{.Names}}'); do
  printf '%s  pasta=%s  volumes=%s\n' "$c" \
    "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$c")" \
    "$(docker inspect -f '{{range .Mounts}}{{.Source}}->{{.Destination}} {{end}}' "$c")"
done

secao "PASTAS QUE O NGINX USA (root/alias/proxy)"
sudo nginx -T 2>/dev/null | grep -E '^\s*(root|alias|proxy_pass) ' | sort | uniq -c

secao "PASTAS QUE NINGUÉM USA (não aparecem no Nginx nem em container)"
USADAS=$( { sudo nginx -T 2>/dev/null | grep -oE '(root|alias) +/[^;]+' | awk '{print $2}';
           for c in $(docker ps -aq); do docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$c"; done; } )
for d in /var/www/*/ /home/ti/*/ /opt/*/ /srv/*/; do
  [ -d "$d" ] || continue; d=${d%/}
  echo "$USADAS" | grep -q "^$d" || echo "  $d"
done

secao "ARQUIVOS DE BACKUP ESPALHADOS (.bak, .old, .orig)"
sudo find /etc/nginx /var/www /home/ti -maxdepth 4 \( -name '*.bak*' -o -name '*.old' -o -name '*.orig' -o -name '*~' \) \
  -not -path '*/node_modules/*' -printf '%TY-%Tm-%Td %8s  %p\n' 2>/dev/null | sort

secao "MAIORES ARQUIVOS FORA DO DOCKER (> 100 MB)"
sudo find / -xdev -type f -size +100M -not -path '/var/lib/docker/*' -not -path '/proc/*' -not -path '/snap/*' \
  -printf '%s %p\n' 2>/dev/null | sort -rn | head -15 | awk '{printf "%7.0f MB  %s\n", $1/1048576, $2}'

secao "node_modules / dist FORA DOS CONTAINERS"
find /home/ti /var/www -maxdepth 4 -type d \( -name node_modules -o -name dist -o -name .venv -o -name __pycache__ \) -prune \
  -exec du -sh {} \; 2>/dev/null | sort -h

secao "DONO E PERMISSÃO DAS PASTAS"
ls -ld /home/ti/*/ /var/www/*/ /opt/*/ /srv/*/ 2>/dev/null

secao "PM2 / SERVIÇOS DO USUÁRIO / CRON"
pm2 list 2>/dev/null | grep -vE '^\s*$' | head -10
ls /etc/systemd/system/*.service 2>/dev/null
crontab -l 2>/dev/null | grep -v '^#'; ls /etc/cron.d

secao "SISTEMA"
lsb_release -ds 2>/dev/null; uname -r; uptime -p
df -h / /boot | tail -2
sudo journalctl --disk-usage 2>/dev/null
apt list --upgradable 2>/dev/null | tail -n +2 | wc -l | xargs echo "pacotes para atualizar:"
snap list 2>/dev/null | tail -n +2 | awk '{print $1}' | xargs echo "snaps:"
docker system df 2>/dev/null
} > "$OUT" 2>&1
echo "Pronto: $OUT ($(wc -l < "$OUT") linhas). Mostre com: cat $OUT"
