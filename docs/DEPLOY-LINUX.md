# Hospedagem do VisionStock no servidor Linux

O sistema roda em dois containers Docker, definidos no `docker-compose.yml`:

| Container | O que faz | Porta |
| :-- | :-- | :-- |
| `web` | Nginx servindo o PWA e repassando `/api` para o backend | `127.0.0.1:8090` (configurável em `ALMOX_PORTA`) |
| `api` | FastAPI + OpenCV + ZXing (leitura de vídeos de drone) | só rede interna |

Os dois reiniciam sozinhos após queda ou reboot (`restart: unless-stopped`), então não é preciso systemd, `.bat` nem túnel temporário.

> **HTTPS é obrigatório.** O navegador do celular só libera a câmera (leitura de QR Code) em HTTPS.
> Por isso o `web` escuta só em `127.0.0.1` e quem atende a internet/rede é o proxy HTTPS que o servidor já usa para os outros apps.

## 1. Pré-requisitos

- Docker Engine e o plugin Compose (`docker compose version`).
- Um (sub)domínio apontando para o servidor, por exemplo `almox.suaempresa.com.br`, ou um túnel Cloudflare **nomeado** (URL fixa).
- Projeto Supabase com as tabelas `crachas` (já existente) e `leituras_almox` (passo 2).

## 2. Banco (uma vez)

No Supabase, abra o **SQL Editor** e rode `supabase/migrations/001_leituras_almox.sql`.
Ele cria a tabela `leituras_almox` (substitui a antiga `bobinas_lidas`) liberando só inserção para a chave pública do app.

## 3. Subir o sistema

```bash
git clone https://github.com/WandersonGuimaraesOlv/VisionStock.git /opt/visionstock
cd /opt/visionstock
cp .env.example .env
nano .env                      # preencha VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e API_KEY
docker compose up -d --build
docker compose ps              # os dois devem ficar "healthy"
curl http://127.0.0.1:8090/api/health
```

Gere a `API_KEY` com `openssl rand -hex 24`.

## 4. Publicar com HTTPS (escolha o que o servidor já usa)

**Num subcaminho de um site Nginx que já existe** (ex.: `https://servidor/visionstock/`, ao lado de outros apps).
No `.env`, use `VITE_BASE_PATH=visionstock` (o build precisa saber o caminho) e acrescente no `server { }` do site:

```nginx
location = /visionstock { return 301 /visionstock/; }
location /visionstock/ {
    proxy_pass http://127.0.0.1:8090/;      # a barra final remove o prefixo antes de chegar ao container
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 600m;
    proxy_request_buffering off;
    proxy_read_timeout 900s;
    proxy_send_timeout 900s;
}
```

Teste e recarregue: `sudo nginx -t && sudo systemctl reload nginx`.

**Num domínio próprio** (deixe `VITE_BASE_PATH` vazio):

**Nginx do host + Certbot**

```nginx
server {
    server_name almox.suaempresa.com.br;
    client_max_body_size 600m;              # vídeos de drone
    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        proxy_read_timeout 900s;
        proxy_send_timeout 900s;
    }
}
```

Depois: `sudo certbot --nginx -d almox.suaempresa.com.br`.

**Caddy** (`/etc/caddy/Caddyfile`)

```
almox.suaempresa.com.br {
    request_body {
        max_size 600MB
    }
    reverse_proxy 127.0.0.1:8090
}
```

**Traefik / Nginx Proxy Manager**: aponte o host para `http://127.0.0.1:8090` (ou coloque o serviço `web` na rede do proxy e remova o `ports`), com limite de upload de 600 MB.

**Cloudflare Tunnel nomeado**: `ingress` com `service: http://127.0.0.1:8090`. Atenção: o plano gratuito da Cloudflare limita uploads a 100 MB.

## 5. Atualizar

```bash
cd /opt/visionstock
git pull
docker compose up -d --build
```

O PWA mostra o aviso "Nova versão disponível" nos coletores na próxima abertura.

## 6. Operação

- Logs: `docker compose logs -f api` / `docker compose logs -f web`.
- Vídeos de drone são apagados do disco logo após o processamento (LGPD).
- `MAX_PROCESSAMENTOS` (padrão 1) limita quantos vídeos são processados ao mesmo tempo; aumente se o servidor tiver CPU sobrando.
- Desenvolvimento local continua com `npm run dev` (frontend) e `cd backend && uvicorn main:app --reload` (backend), usando `VITE_API_URL=http://localhost:8000` no `.env`.
