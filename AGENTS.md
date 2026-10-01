# 🤖 Diretrizes do Agente & Regras do Projeto — Inventário Universal de Almoxarifado (ALMOX)

> **Arquivo de Instruções do Agente AI (`AGENTS.md`)**  
> **Versão:** 3.0 — Sistema Universal de Almoxarifado (SaaS Ready)  
> **Status:** Ativo  
> **Idioma Padrão:** Português do Brasil (pt-BR)  

---

## 📌 Visão Geral & Escopo do Projeto

O **Sistema de Inventário Universal de Almoxarifado (ALMOX)** é uma aplicação web/PWA industrial de alta performance projetada para automação, contagem física e conciliação de estoque em tempo real para qualquer segmento industrial ou comercial integrado ao **SAP ERP**.

### 🔄 Transição de Escopo (Videplast Bobinas → ALMOX Universal)
- **Anterior:** Sistema específico para bobinas de filmes flexíveis da Videplast (validação por prefixos de lote `VA`, `MA`, `TA`, tags `VL...LT`).
- **Atual:** Solução universal, agnóstica e comercializável (SaaS Ready). A validação dos itens é realizada utilizando o código do `Material` (SKU) extraído da planilha **"ETIQUETAS"**, sem dependência de regras rígidas de bobinas.

---

## 🏗️ Arquitetura Técnica & Tecnologias

- **Frontend:** React 19 + Vite 8 + Bootstrap 5 + PWA Service Worker.
- **Camada Offline-First (IndexedDB):** Dexie.js para persistência local instantânea e resiliência total a oscilações de rede no galpão.
- **Backend / Supabase:** Supabase (PostgreSQL 15 + Auth + Realtime REST API).
- **Backend de IA / Visão Computacional:** Python 3.12 + FastAPI + OpenCV + ZXing-C++ em container Docker (para leitura em massa por vídeos de drone).

---

## 📋 Estrutura da Base de Dados SAP ("ETIQUETAS")

O sistema consome planilhas de referência exportadas do SAP ERP no formato CSV/Excel com as seguintes colunas obrigatórias:

| Coluna | Tipo | Descrição & Uso no Sistema |
| :--- | :--- | :--- |
| `Material` | Text / String | Código único identificador do item (SKU). Serve como **chave primária** de validação da leitura. |
| `Texto breve material` | Text | Descrição simplificada do produto para confirmação visual do operador na tela. |
| `Endereço` | Text | Localização física no galpão/almoxarifado (ex: `P12 A 13`, `Gôndola B`). |
| `Depósito` | Text | Código ou nome da unidade/almoxarifado (ex: `1001`, `Depósito Central`). |
| `Quantidade SAP` | Numeric | Saldo teórico registrado no SAP ERP. Base para cálculo de conciliação (**OK**, **Falta**, **Sobra**). |

---

## ⚙️ Regras de Negócio Fundamentais (Business Rules)

### RN-001: Validação Universal por Material
- Todo QR Code ou Código de Barras lido deve ser validado buscando correspondência com a coluna `Material` da planilha SAP importada.
- O parser deve ser capaz de extrair a string do código do `Material` mesmo que a etiqueta contenha dados concatenados ou formatações adicionais.
- Descontinuar a obrigatoriedade de prefixos de filiais (`MA`, `VA`, `TA`) ou regex específicas de lote (`VL...LT`).

### RN-002: Coleta de Quantidade Física Pós-Leitura
- Após cada bipagem/leitura válida do código de `Material`, o sistema deve exibir obrigatoriamente uma **Tela/Modal de Input Numérico** para que o operador informe a **Quantidade Física** contada.
- O sistema não deve assumir a quantidade fixa `1` automaticamente sem a confirmação do operador, permitindo fracionamento ou contagens agrupadas.

### RN-003: Validação de Endereçamento & Alertas de Setor
- Caso um item seja lido em um `Endereço` ou `Depósito` diferente daquele cadastrado na planilha SAP:
  - O sistema exibe um alerta sonoro e visual de **"Local Incorreto"**.
  - O sistema **PERMITE** o registro da contagem física para não travar a operação do galpão, porém sinaliza a **divergência de localização** no relatório final.

### RN-004: Motor de Conciliação Física vs. SAP
- A conciliação compara o somatório das **Quantidades Físicas Lidas** contra a **Quantidade SAP**:
  1. **OK:** Quantidade lida == Quantidade SAP (no endereço correto).
  2. **Faltando:** Quantidade lida < Quantidade SAP.
  3. **Sobra:** Quantidade lida > Quantidade SAP ou item não previsto na base importada.
  4. **Local Incorreto:** Item encontrado e lido em endereço/depósito divergente da planilha SAP.

### RN-005: Operação Offline-First Padrão
- Todas as leituras e inputs de quantidade são gravados instantaneamente no IndexedDB via Dexie.js.
- Caso não haja conexão de rede (Wi-Fi/4G), o sistema opera em modo autônomo sem bloquear o operador.
- Ao restabelecer a conectividade, a fila de sincronização (`leituras_pendentes`) envia as atualizações em lote (*batching*) para o Supabase.

### RN-006: Leitura em Massa via Drone & Visão Computacional
- O backend em Python FastAPI continua responsável pelo processamento de vídeos (.MP4/.MOV) gravados por drones nos corredores de prateleiras elevadas, utilizando OpenCV e ZXing-C++ para extração e deduplicação de etiquetas.

---

## 🛠️ Diretrizes de Código e Padrões de Desenvolvimento

1. **Idioma do Código & Respostas:**
   - As respostas do assistente e a documentação DEVEM ser sempre prestadas em **Português do Brasil (pt-BR)**.
   - Variáveis, comentários e nomes de funções no código-fonte devem manter clareza e semântica profissional.

2. **Componentização React (SPA):**
   - Manter a UI mobile-first tátil e responsiva para coletores de dados e smartphones.
   - Atualizar a máquina de estados no `App.jsx` para suportar o novo fluxo:  
     `LOGIN → CONFIG/IMPORT_SAP → SELEÇÃO_ENDEREÇO → BIPAGEM → INPUT_QUANTIDADE → CONCILIAÇÃO`.

3. **Performance e Resiliência:**
   - Garantir que a inserção local em IndexedDB ocorra em tempo sub-milissegundo para impedir atrasos na bipagem física contínua.
   - Não disparar bloqueios de interface em falhas de rede HTTP.

---

## 📁 Estrutura de Arquivos Principal do Projeto

```
VisionStock/
├── .agents/AGENTS.md           # Espelho destas regras
├── AGENTS.md                   # Regras do projeto (este arquivo)
├── Dockerfile                  # Build do frontend + Nginx (produção)
├── docker-compose.yml          # Sobe web (Nginx/PWA) + api (FastAPI drone) no servidor Linux
├── .env.example                # Variáveis de ambiente (copiar para .env)
├── deploy/nginx.conf           # Nginx: PWA + proxy de /api para o backend
├── docs/DEPLOY-LINUX.md        # Passo a passo de hospedagem no servidor
├── supabase/migrations/        # SQL das tabelas do Supabase (leituras_almox)
├── backend/                    # Backend FastAPI (Drone & IA)
│   ├── main.py                 # Ponto de entrada (uvicorn main:app)
│   ├── app/                    # config.py, seguranca.py, visao.py (OpenCV/ZXing), rotas.py
│   └── tests/                  # pytest
├── public/sw.js                # Service Worker (offline do PWA)
├── tests/                      # Vitest das regras de negócio
└── src/
    ├── main.jsx
    ├── app/                    # App.jsx (orquestrador), estados.js (máquina de estados), config.js (VITE_*)
    ├── modules/                # Um módulo por funcionalidade, cada um com index.js público
    │   ├── auth/               # Login por crachá
    │   ├── importacao-sap/     # Parser da planilha ETIQUETAS
    │   ├── inventario/         # Seleção de local, bipagem, modal de quantidade (RN-001/002/003)
    │   ├── conciliacao/        # Motor OK/Falta/Sobra/Local Incorreto (RN-004) + CSV
    │   ├── drone/              # Upload de vídeo para o backend (RN-006)
    │   └── sync/               # Fila offline → Supabase (RN-005)
    └── shared/                 # components/, hooks/, lib/ (Dexie, Supabase, áudio, código, números)
```

Regras de modularização:
- Um módulo só importa outro pelo `index.js` dele; lógica de negócio fica em funções puras testadas em `tests/`.
- Variáveis de ambiente são lidas só em `src/app/config.js` (frontend) e `backend/app/config.py` (backend).
