#!/usr/bin/env bash
# Organiza o Inventário de Bobinas no servidor SEM mudar o que está no ar:
#   1. backup da pasta inteira (sem os vídeos)
#   2. docker-compose.yml que repete exatamente o "docker run" atual do backend de drone
#   3. troca o container solto pelo do compose (mesma imagem, mesma porta, mesmos vídeos)
#   4. corrige permissões 777/666
#   5. git local na pasta, para ter histórico das próximas mudanças
# Se o backend não responder, volta sozinho para o container antigo.
#
# Uso:  bash organizar-bobinas.sh            (aplica)
#       bash organizar-bobinas.sh desfazer   (volta para o container solto)
set -euo pipefail
DIR=/var/www/inventario-bobinas
IMAGEM=drone-backend:v2.4
cd "$DIR"

container_solto() {  # recria o container como estava antes (comando do histórico)
  docker rm -f drone-backend-app >/dev/null 2>&1 || true
  docker run -d --name drone-backend-app --restart always -p 127.0.0.1:8000:8000 \
    -v "$DIR/backend/videos_drone:/app/videos_drone" "$IMAGEM" >/dev/null
}

responde() { for _ in $(seq 1 15); do curl -s -o /dev/null http://127.0.0.1:8000/ && return 0; sleep 2; done; return 1; }

if [ "${1:-}" = desfazer ]; then
  docker compose down 2>/dev/null || true
  container_solto
  responde && echo "DESFEITO: container solto de volta" || echo "ERRO: backend não respondeu"
  exit 0
fi

echo "== 1/5 Backup (sem os vídeos)"
mkdir -p ~/backups
tar -czf ~/backups/bobinas-antes-compose-$(date +%Y%m%d-%H%M).tgz --exclude='backend/videos_drone' -C /var/www inventario-bobinas
ls -lh ~/backups/bobinas-antes-compose-*.tgz | tail -1

echo "== 2/5 docker-compose.yml"
cat > docker-compose.yml <<'EOF'
# Inventário de Bobinas: backend de drone (FastAPI). O site é a pasta dist/, servida pelo Nginx do servidor.
# Atualizar o backend: docker compose up -d --build
name: bobinas
services:
  drone:
    build: ./backend
    image: drone-backend:v2.4
    container_name: drone-backend-app
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    volumes:
      - ./backend/videos_drone:/app/videos_drone
    healthcheck:
      test: ["CMD", "python", "-c", "import socket; socket.create_connection(('127.0.0.1', 8000), 3)"]
      interval: 30s
      timeout: 5s
      retries: 3
EOF
docker compose config -q && echo "  compose válido"

echo "== 3/5 Trocando o container solto pelo do compose (mesma imagem, sem rebuild)"
docker rm -f drone-backend-app-anterior >/dev/null 2>&1 && echo "  removido o container parado drone-backend-app-anterior" || true
docker rm -f drone-backend-app >/dev/null
docker compose up -d --no-build
if responde; then echo "  BACKEND OK em 127.0.0.1:8000 (compose)"
else echo "  FALHOU: voltando o container antigo"; docker compose down || true; container_solto; responde && echo "  container antigo de volta"; exit 1; fi

echo "== 4/5 Permissões (tira o 777/666)"
sudo chown -R ti:ti "$DIR/dist"
find "$DIR" -path "$DIR/backend/videos_drone" -prune -o -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +
sudo chmod 755 "$DIR/backend/videos_drone"
ls -ld "$DIR" "$DIR/backend" "$DIR/dist" "$DIR/backend/videos_drone"

echo "== 5/5 Git local (histórico das próximas mudanças)"
if [ ! -d .git ]; then
  printf 'backend/videos_drone/\n__pycache__/\n*.pyc\n' > .gitignore
  git init -q -b main
  git add -A
  git -c user.name="ti" -c user.email="ti@localhost" commit -qm "Estado no servidor em $(date +%d/%m/%Y): backend de drone + site (dist) + compose"
fi
git log --oneline -1

echo "== Conferência"
docker compose ps
curl -s -o /dev/null -w "/bobinas/ %{http_code} (302 = pede login)\n" http://127.0.0.1/bobinas/
curl -s -o /dev/null -w "/drone-api/ %{http_code} (302 = pede login)\n" http://127.0.0.1/drone-api/
echo "PRONTO. Para voltar como era: bash $0 desfazer"
