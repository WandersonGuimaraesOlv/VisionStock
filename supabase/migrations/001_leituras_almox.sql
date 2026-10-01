-- VisionStock (ALMOX) — tabela que recebe as contagens físicas sincronizadas pelo app.
-- Substitui a antiga "bobinas_lidas". Rode uma vez no SQL Editor do Supabase.

create table if not exists public.leituras_almox (
  id                bigint generated always as identity primary key,
  id_local          text        not null unique,   -- id gerado no aparelho; evita duplicar em reenvios
  sessao_id         text        not null,
  material          text        not null,
  texto_breve       text,
  deposito_lido     text,
  endereco_lido     text,
  deposito_sap      text,
  endereco_sap      text,
  quantidade_fisica numeric     not null check (quantidade_fisica > 0),
  local_incorreto   boolean     not null default false,
  item_encontrado   boolean     not null default true,
  cracha_leitura    text,
  nome_operador     text,
  created_at        timestamptz not null default now(),
  recebido_em       timestamptz not null default now()
);

create index if not exists leituras_almox_sessao_idx   on public.leituras_almox (sessao_id);
create index if not exists leituras_almox_material_idx on public.leituras_almox (material);

-- O app usa a chave anon: libera só inserção (sem leitura, alteração ou exclusão pela chave pública).
alter table public.leituras_almox enable row level security;

drop policy if exists "app insere leituras" on public.leituras_almox;
create policy "app insere leituras"
  on public.leituras_almox for insert
  to anon, authenticated
  with check (true);
