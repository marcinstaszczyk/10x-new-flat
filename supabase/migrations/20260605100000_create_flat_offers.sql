create table public.flat_offers (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null default auth.uid()
    constraint flat_offers_buyer_id_fkey references auth.users (id) on delete cascade,
  title text not null
    constraint flat_offers_title_not_blank check (length(btrim(title)) > 0),
  source_url text
    constraint flat_offers_source_url_not_blank check (
      source_url is null or length(btrim(source_url)) > 0
    ),
  pasted_content text not null
    constraint flat_offers_pasted_content_not_blank check (length(btrim(pasted_content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.flat_offers is
  'Buyer-owned saved flat offer source material for later extraction.';

create index flat_offers_buyer_updated_at_idx
  on public.flat_offers (buyer_id, updated_at desc, created_at desc, id desc);

create function public.set_flat_offers_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_flat_offers_updated_at() from public, anon, authenticated;

create trigger set_flat_offers_updated_at
before update on public.flat_offers
for each row
execute function public.set_flat_offers_updated_at();

alter table public.flat_offers enable row level security;

create policy "Buyers can read their own flat offers"
on public.flat_offers
for select
to authenticated
using ((select auth.uid()) = buyer_id);

create policy "Buyers can insert their own flat offers"
on public.flat_offers
for insert
to authenticated
with check ((select auth.uid()) = buyer_id);

create policy "Buyers cannot update flat offers"
on public.flat_offers
for update
to authenticated
using (false)
with check (false);

create policy "Buyers can delete their own flat offers"
on public.flat_offers
for delete
to authenticated
using ((select auth.uid()) = buyer_id);

revoke all on table public.flat_offers from public, anon, authenticated;

grant select, delete on table public.flat_offers to authenticated;

grant insert (title, source_url, pasted_content)
  on table public.flat_offers to authenticated;
