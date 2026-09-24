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

-- ================== Cursos subestimados / sobrestimados ==================
-- Cada palpite conta para o curso que estava escondido:
--   vezes        = quantas vezes os jogadores tiveram de adivinhar este curso;
--   subestimado  = errou por achar que era mais baixo (e era mais alto);
--   sobrestimado = errou por achar que era mais alto (e era mais baixo).
-- "campo" separa os modos de notas ('nota') dos modos de vagas ('vagas').
create table if not exists public.palpites_cursos (
  campo        text    not null check (campo in ('nota', 'vagas')),
  chave        text    not null check (char_length(chave) between 3 and 300),
  vezes        integer not null default 0,
  subestimado  integer not null default 0,
  sobrestimado integer not null default 0,
  primary key (campo, chave)
);
-- tabelas criadas pela versão anterior (sem "vezes"): os erros já contados também foram palpites
alter table public.palpites_cursos add column if not exists vezes integer not null default 0;
update public.palpites_cursos set vezes = subestimado + sobrestimado where vezes < subestimado + sobrestimado;

-- Percentagem de palpites em que o curso foi subestimado / sobrestimado.
create or replace view public.palpites_cursos_pct with (security_invoker = on) as
select campo, chave, vezes, subestimado, sobrestimado,
       round(100.0 * subestimado / nullif(vezes, 0), 1)  as pct_sub,
       round(100.0 * sobrestimado / nullif(vezes, 0), 1) as pct_sobre
from public.palpites_cursos;

-- Qualquer pessoa pode ler; só a função abaixo escreve (soma, nunca apaga nem diminui).
alter table public.palpites_cursos enable row level security;
drop policy if exists "ler palpites" on public.palpites_cursos;
create policy "ler palpites" on public.palpites_cursos for select to anon, authenticated using (true);
grant select on public.palpites_cursos to anon, authenticated;
grant select on public.palpites_cursos_pct to anon, authenticated;
revoke insert, update, delete on public.palpites_cursos from anon, authenticated;

-- Recebe os palpites de um jogo: [{"campo":"nota","chave":"...","tipo":"ok"|"sub"|"sobre"}, ...] (máx. 300).
create or replace function public.registar_palpites(eventos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(eventos) <> 'array' or jsonb_array_length(eventos) > 300 then
    raise exception 'eventos inválidos';
  end if;
  insert into public.palpites_cursos as p (campo, chave, vezes, subestimado, sobrestimado)
  select v->>'campo', v->>'chave',
         count(*),
         count(*) filter (where v->>'tipo' = 'sub'),
         count(*) filter (where v->>'tipo' = 'sobre')
  from jsonb_array_elements(eventos) as e(v)
  where v->>'campo' in ('nota', 'vagas') and v->>'tipo' in ('ok', 'sub', 'sobre')
    and char_length(v->>'chave') between 3 and 300
  group by 1, 2
  on conflict (campo, chave) do update
    set vezes = p.vezes + excluded.vezes,
        subestimado = p.subestimado + excluded.subestimado,
        sobrestimado = p.sobrestimado + excluded.sobrestimado;
end $$;
revoke all on function public.registar_palpites(jsonb) from public;
grant execute on function public.registar_palpites(jsonb) to anon, authenticated;
