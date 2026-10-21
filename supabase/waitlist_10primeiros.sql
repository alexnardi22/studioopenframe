-- Lista de espera "Seja um dos 10" · studioopenframe.com/10primeiros
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run.

create table if not exists public.waitlist_10primeiros (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nome          text not null check (char_length(nome) between 2 and 120),
  whatsapp      text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  tipo_empresa  text not null check (tipo_empresa in (
                  'Limpeza', 'Construção/Reformas', 'Pintura', 'Landscaping',
                  'Pisos', 'Mudanças', 'Estética/Beleza', 'Outro')),
  cidade_estado text not null check (char_length(cidade_estado) between 2 and 120),
  dificuldade   text check (dificuldade is null or char_length(dificuldade) <= 2000),
  consentimento boolean not null check (consentimento = true),
  origem        text check (origem is null or char_length(origem) <= 120),
  constraint waitlist_10primeiros_whatsapp_unico unique (whatsapp)
);

-- Segurança: o público só pode inserir. Ninguém de fora consegue ler, alterar ou apagar.
alter table public.waitlist_10primeiros enable row level security;

revoke all on table public.waitlist_10primeiros from anon, authenticated;
grant insert (nome, whatsapp, tipo_empresa, cidade_estado, dificuldade, consentimento, origem)
  on table public.waitlist_10primeiros to anon, authenticated;

drop policy if exists "publico_pode_inserir" on public.waitlist_10primeiros;
create policy "publico_pode_inserir"
  on public.waitlist_10primeiros
  for insert
  to anon, authenticated
  with check (consentimento = true);

-- Sem política de SELECT/UPDATE/DELETE: leitura só pelo painel do Supabase (Table Editor)
-- ou com a chave service_role, que nunca vai para o navegador.
