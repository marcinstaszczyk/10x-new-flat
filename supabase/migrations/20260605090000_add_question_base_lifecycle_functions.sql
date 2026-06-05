create function public.ensure_buyer_question_base()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_buyer_id uuid := auth.uid();
begin
  if current_buyer_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_buyer_id::text, 0)
  );

  if exists (
    select 1
    from public.buyer_questions
    where buyer_id = current_buyer_id
  ) then
    return;
  end if;

  insert into public.buyer_questions (
    buyer_id,
    source_template_id,
    question_type,
    text,
    position
  )
  select
    current_buyer_id,
    question_templates.id,
    question_templates.question_type,
    question_templates.text,
    question_templates.position
  from public.question_templates
  where question_templates.is_active
  order by question_templates.position;
end;
$$;

create function public.reset_buyer_question_base()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_buyer_id uuid := auth.uid();
begin
  if current_buyer_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_buyer_id::text, 0)
  );

  delete from public.buyer_questions
  where buyer_id = current_buyer_id;

  insert into public.buyer_questions (
    buyer_id,
    source_template_id,
    question_type,
    text,
    position
  )
  select
    current_buyer_id,
    question_templates.id,
    question_templates.question_type,
    question_templates.text,
    question_templates.position
  from public.question_templates
  where question_templates.is_active
  order by question_templates.position;
end;
$$;

revoke execute on function public.ensure_buyer_question_base() from public, anon, authenticated;
revoke execute on function public.reset_buyer_question_base() from public, anon, authenticated;

grant execute on function public.ensure_buyer_question_base() to authenticated;
grant execute on function public.reset_buyer_question_base() to authenticated;
