create table public.offer_extraction_results (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null
    constraint offer_extraction_results_offer_id_fkey
      references public.flat_offers (id) on delete cascade,
  buyer_id uuid not null default auth.uid()
    constraint offer_extraction_results_buyer_id_fkey
      references auth.users (id) on delete cascade,
  status text not null default 'completed'
    constraint offer_extraction_results_status_completed check (status = 'completed'),
  result jsonb not null
    constraint offer_extraction_results_result_object check (jsonb_typeof(result) = 'object'),
  model text not null
    constraint offer_extraction_results_model_not_blank check (length(btrim(model)) > 0),
  latency_ms integer not null
    constraint offer_extraction_results_latency_ms_not_negative check (latency_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_extraction_results_offer_id_unique unique (offer_id)
);

comment on table public.offer_extraction_results is
  'Buyer-owned persisted viewing preparation result for a saved flat offer.';

create index offer_extraction_results_offer_lookup_idx
  on public.offer_extraction_results (offer_id, buyer_id);

create index offer_extraction_results_buyer_created_at_idx
  on public.offer_extraction_results (buyer_id, created_at desc, id desc);

create function public.ensure_offer_extraction_result_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.flat_offers
    where id = new.offer_id
      and buyer_id = new.buyer_id
  ) then
    raise exception 'Extraction result buyer must own the referenced offer'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.ensure_offer_extraction_result_owner() from public, anon, authenticated;

create trigger ensure_offer_extraction_result_owner
before insert or update on public.offer_extraction_results
for each row
execute function public.ensure_offer_extraction_result_owner();

create function public.set_offer_extraction_results_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_offer_extraction_results_updated_at() from public, anon, authenticated;

create trigger set_offer_extraction_results_updated_at
before update on public.offer_extraction_results
for each row
execute function public.set_offer_extraction_results_updated_at();

alter table public.offer_extraction_results enable row level security;

create policy "Buyers can read their own offer extraction results"
on public.offer_extraction_results
for select
to authenticated
using ((select auth.uid()) = buyer_id);

create policy "Buyers can insert results for their own offers"
on public.offer_extraction_results
for insert
to authenticated
with check (
  (select auth.uid()) = buyer_id
  and exists (
    select 1
    from public.flat_offers
    where flat_offers.id = offer_extraction_results.offer_id
      and flat_offers.buyer_id = (select auth.uid())
  )
);

create policy "Buyers cannot update offer extraction results"
on public.offer_extraction_results
for update
to authenticated
using (false)
with check (false);

create policy "Buyers cannot delete offer extraction results"
on public.offer_extraction_results
for delete
to authenticated
using (false);

revoke all on table public.offer_extraction_results from public, anon, authenticated;

grant select on table public.offer_extraction_results to authenticated;

grant insert (offer_id, result, model, latency_ms)
  on table public.offer_extraction_results to authenticated;
