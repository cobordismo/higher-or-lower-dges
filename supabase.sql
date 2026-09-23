-- Leaderboard do Higher or Lower — correr uma vez no Supabase (SQL Editor → New query → Run).

create table if not exists public.pontuacoes (
  id            uuid primary key default gen_random_uuid(),
  nome          text        not null check (char_length(btrim(nome)) between 1 and 20),
  modo          text        not null,
  pontos        integer     not null check (pontos between 1 and 1000),
  melhor_streak integer     not null default 0 check (melhor_streak between 0 and 1000),
  criado_em     timestamptz not null default now()
);

-- Modos aceites (também atualiza tabelas criadas com a versão anterior; linhas antigas não são revalidadas).
alter table public.pontuacoes drop constraint if exists pontuacoes_modo_check;
alter table public.pontuacoes add constraint pontuacoes_modo_check
  check (modo in ('classico', 'relogio', 'vagas', 'vagas-relogio')) not valid;

create index if not exists pontuacoes_modo_pontos on public.pontuacoes (modo, pontos desc, criado_em);
create index if not exists pontuacoes_modo_chave on public.pontuacoes (modo, lower(btrim(nome)), pontos desc);

-- Leaderboard: cada jogador aparece uma vez por modo, com a sua melhor pontuação.
-- "chave" é o nome sem maiúsculas nem espaços nas pontas ("Miguel" e "miguel " são o mesmo jogador).
-- security_invoker faz a vista respeitar as regras (RLS) da tabela.
create or replace view public.melhores with (security_invoker = on) as
select distinct on (modo, lower(btrim(nome)))
  nome, lower(btrim(nome)) as chave, modo, pontos, melhor_streak, criado_em
from public.pontuacoes
order by modo, lower(btrim(nome)), pontos desc, criado_em asc;

-- Segurança: qualquer pessoa pode ler e inserir; ninguém pode alterar ou apagar pela API.
alter table public.pontuacoes enable row level security;

drop policy if exists "ler pontuacoes" on public.pontuacoes;
create policy "ler pontuacoes" on public.pontuacoes
  for select to anon, authenticated using (true);

drop policy if exists "inserir pontuacoes" on public.pontuacoes;
create policy "inserir pontuacoes" on public.pontuacoes
  for insert to anon, authenticated with check (criado_em > now() - interval '1 minute');

grant select, insert on public.pontuacoes to anon, authenticated;
revoke update, delete on public.pontuacoes from anon, authenticated;
grant select on public.melhores to anon, authenticated;

-- Para apagar uma pontuação falsa: Table Editor → pontuacoes → selecionar a linha → Delete.
