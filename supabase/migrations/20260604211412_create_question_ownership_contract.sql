create type public.question_type as enum ('category', 'open_question');

create table public.question_templates (
  id uuid primary key default gen_random_uuid(),
  question_type public.question_type not null,
  text text not null
    constraint question_templates_text_not_blank check (length(btrim(text)) > 0),
  position integer not null
    constraint question_templates_position_not_negative check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint question_templates_position_unique unique (position)
);

comment on table public.question_templates is
  'Canonical ordered question document. Category membership is positional, not relational.';

create index question_templates_active_position_idx
  on public.question_templates (position)
  where is_active;

create table public.buyer_questions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null
    constraint buyer_questions_buyer_id_fkey references auth.users (id) on delete cascade,
  source_template_id uuid
    constraint buyer_questions_source_template_id_fkey
      references public.question_templates (id) on delete restrict,
  question_type public.question_type not null,
  text text not null
    constraint buyer_questions_text_not_blank check (length(btrim(text)) > 0),
  position integer not null
    constraint buyer_questions_position_not_negative check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyer_questions_buyer_position_unique unique (buyer_id, position)
);

comment on table public.buyer_questions is
  'Buyer-owned ordered question document. Category rows are display headers and do not own following rows.';

create index buyer_questions_source_template_id_idx
  on public.buyer_questions (source_template_id)
  where source_template_id is not null;

create function public.set_buyer_questions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_buyer_questions_updated_at() from public, anon, authenticated;

create trigger set_buyer_questions_updated_at
before update on public.buyer_questions
for each row
execute function public.set_buyer_questions_updated_at();

alter table public.question_templates enable row level security;
alter table public.buyer_questions enable row level security;

create policy "Authenticated users can read active question templates"
on public.question_templates
for select
to authenticated
using (is_active);

create policy "Buyers can read their own questions"
on public.buyer_questions
for select
to authenticated
using ((select auth.uid()) = buyer_id);

create policy "Buyers can insert their own questions"
on public.buyer_questions
for insert
to authenticated
with check ((select auth.uid()) = buyer_id);

create policy "Buyers can update their own questions"
on public.buyer_questions
for update
to authenticated
using ((select auth.uid()) = buyer_id)
with check ((select auth.uid()) = buyer_id);

create policy "Buyers can delete their own questions"
on public.buyer_questions
for delete
to authenticated
using ((select auth.uid()) = buyer_id);

revoke all on table public.question_templates from public, anon, authenticated;
revoke all on table public.buyer_questions from public, anon, authenticated;

grant select on table public.question_templates to authenticated;
grant select, insert, update, delete on table public.buyer_questions to authenticated;
