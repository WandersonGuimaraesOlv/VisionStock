#!/usr/bin/env bash
# Deixa o Imobilizados igual ao GitHub (repositório do Matheus) e guarda as configurações do servidor à parte:
#   - porta só em 127.0.0.1 vai para docker-compose.override.yml (o docker-compose.yml volta a ser o do GitHub)
#   - .dockerignore local, para o build não copiar node_modules da máquina
#   - apaga node_modules/dist de fora do container (sobras de build manual; o Docker instala dentro da imagem)
#   - "git pull" passa a funcionar sem conflito
# Não reconstrói nem reinicia o sistema; só confere que a configuração final é a mesma que está no ar.
set -euo pipefail
DIR=/var/www/imobilizados
cd "$DIR"

echo "== 1/4 Backup"
mkdir -p ~/backups
tar -czf ~/backups/imobilizados-antes-organizar-$(date +%Y%m%d-%H%M).tgz \
  --exclude='node_modules' --exclude='dist' -C /var/www imobilizados
ls -lh ~/backups/imobilizados-antes-organizar-*.tgz | tail -1

echo "== 2/4 Configurações do servidor fora dos arquivos do GitHub"
cat > docker-compose.override.yml <<'EOF'
# Ajustes só deste servidor (não vão para o GitHub). O Docker Compose junta este arquivo com o docker-compose.yml.
services:
  imobilizados:
    ports: !override
      - "127.0.0.1:3001:3001"   # só o Nginx do servidor acessa; o login fica no Portal de Acesso
EOF
printf '**/node_modules\n**/dist\n**/.env\n.git\n*.bak*\n' > .dockerignore
grep -qxF 'docker-compose.override.yml' .git/info/exclude 2>/dev/null || \
  printf 'docker-compose.override.yml\n.dockerignore\n*.bak*\n' >> .git/info/exclude
git config core.fileMode false   # ignora a mudança de permissão do build.sh
git checkout -- docker-compose.yml frontend/package-lock.json
rm -f docker-compose.yml.bak-melhorias

# Confere: a configuração final tem que publicar a porta só em 127.0.0.1
PORTAS=$(docker compose config --format json | python3 -c 'import json,sys; c=json.load(sys.stdin); print([(p.get("host_ip",""),p.get("published")) for s in c["services"].values() for p in s.get("ports",[])])')
echo "  portas finais: $PORTAS"
if ! echo "$PORTAS" | grep -q "('127.0.0.1', '3001')" || echo "$PORTAS" | grep -q "('', "; then
  echo "  ERRO: a porta não ficou só em 127.0.0.1. Voltando o docker-compose.yml do backup."
  tar -xzf "$(ls -t ~/backups/imobilizados-antes-organizar-*.tgz | head -1)" -C /var/www imobilizados/docker-compose.yml
  rm -f docker-compose.override.yml; exit 1
fi

echo "== 3/4 Sobras de build fora do container"
du -sh backend/node_modules frontend/node_modules frontend/dist 2>/dev/null || true
rm -rf backend/node_modules frontend/node_modules frontend/dist

echo "== 4/4 Conferência"
git status -sb | head -5
docker compose up -d >/dev/null 2>&1   # não recria nada se a configuração for a mesma
docker ps --filter name=imobilizados-app --format '{{.Names}}: {{.Status}}  {{.Ports}}'
curl -s -o /dev/null -w "/imobilizados/ %{http_code} (302 = pede login)\n" http://127.0.0.1/imobilizados/
curl -s -o /dev/null -w "direto na 3001: %{http_code} (200 = app no ar)\n" http://127.0.0.1:3001/
du -sh "$DIR"
echo "PRONTO. Atualizar no futuro: cd $DIR && git pull && docker compose up -d --build"
