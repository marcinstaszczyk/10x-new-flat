begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'buyer-a@example.com',
    '',
    now(),
    '{}',
    '{}'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    'buyer-b@example.com',
    '',
    now(),
    '{}',
    '{}'
  );

insert into public.flat_offers (
  id,
  buyer_id,
  title,
  source_url,
  pasted_content
)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Buyer A offer',
    null,
    'Buyer A pasted content'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Buyer A second offer',
    null,
    'Buyer A second pasted content'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Buyer A cascade offer',
    null,
    'Buyer A cascade pasted content'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Buyer B offer',
    null,
    'Buyer B pasted content'
  );

insert into public.offer_extraction_results (
  id,
  offer_id,
  buyer_id,
  result,
  model,
  latency_ms
)
values
  (
    'aaaaaaaa-1111-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{"answeredQuestions":[],"unansweredQuestions":[],"doubtfulFacts":[],"unmappedFacts":[]}'::jsonb,
    'openrouter/test-model',
    100
  ),
  (
    'aaaaaaaa-1111-4000-8000-000000000003',
    'aaaaaaaa-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{"answeredQuestions":[],"unansweredQuestions":[],"doubtfulFacts":[],"unmappedFacts":[]}'::jsonb,
    'openrouter/test-model',
    150
  ),
  (
    'bbbbbbbb-1111-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '{"answeredQuestions":[],"unansweredQuestions":[],"doubtfulFacts":[],"unmappedFacts":[]}'::jsonb,
    'openrouter/test-model',
    200
  );

select has_table('public', 'offer_extraction_results', 'offer_extraction_results exists');

select ok(
  (
    select count(*) = 9
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offer_extraction_results'
      and column_name in (
        'id',
        'offer_id',
        'buyer_id',
        'status',
        'result',
        'model',
        'latency_ms',
        'created_at',
        'updated_at'
      )
  ),
  'offer_extraction_results has the expected columns'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.offer_extraction_results'::regclass),
  true,
  'offer_extraction_results has RLS enabled'
);

select ok(
  (
    select count(*) = 8
    from pg_constraint
    where conname in (
      'offer_extraction_results_buyer_id_fkey',
      'offer_extraction_results_latency_ms_not_negative',
      'offer_extraction_results_model_not_blank',
      'offer_extraction_results_offer_id_fkey',
      'offer_extraction_results_offer_id_unique',
      'offer_extraction_results_pkey',
      'offer_extraction_results_result_object',
      'offer_extraction_results_status_completed'
    )
  ),
  'offer_extraction_results ownership, shape, and uniqueness constraints exist'
);

select ok(
  (
    select count(*) = 2
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'offer_extraction_results'
      and indexname in (
        'offer_extraction_results_offer_lookup_idx',
        'offer_extraction_results_buyer_created_at_idx'
      )
  ),
  'offer_extraction_results has owner-scoped lookup indexes'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.ensure_offer_extraction_result_owner()'::regprocedure
  ),
  'offer_extraction_results ownership trigger function exists'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.set_offer_extraction_results_updated_at()'::regprocedure
  ),
  'offer_extraction_results updated-at trigger function exists'
);

select ok(
  (
    select count(*) = 2
    from pg_trigger
    where tgrelid = 'public.offer_extraction_results'::regclass
      and tgname in (
        'ensure_offer_extraction_result_owner',
        'set_offer_extraction_results_updated_at'
      )
  ),
  'offer_extraction_results ownership and updated-at triggers exist'
);

select ok(
  (
    select count(*) = 4
      and count(*) filter (where cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) = 4
    from pg_policies
    where schemaname = 'public'
      and tablename = 'offer_extraction_results'
  ),
  'offer_extraction_results has explicit policies for select, insert, update, and delete'
);

select ok(
  not has_table_privilege('anon', 'public.offer_extraction_results', 'select')
    and not has_table_privilege('anon', 'public.offer_extraction_results', 'insert')
    and not has_table_privilege('anon', 'public.offer_extraction_results', 'update')
    and not has_table_privilege('anon', 'public.offer_extraction_results', 'delete'),
  'anonymous users have no offer_extraction_results table privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.offer_extraction_results', 'select')
    and not has_table_privilege('authenticated', 'public.offer_extraction_results', 'update')
    and not has_table_privilege('authenticated', 'public.offer_extraction_results', 'delete')
    and has_column_privilege('authenticated', 'public.offer_extraction_results', 'offer_id', 'insert')
    and has_column_privilege('authenticated', 'public.offer_extraction_results', 'result', 'insert')
    and has_column_privilege('authenticated', 'public.offer_extraction_results', 'model', 'insert')
    and has_column_privilege('authenticated', 'public.offer_extraction_results', 'latency_ms', 'insert')
    and not has_column_privilege('authenticated', 'public.offer_extraction_results', 'buyer_id', 'insert')
    and not has_column_privilege('authenticated', 'public.offer_extraction_results', 'status', 'insert')
    and not has_column_privilege('authenticated', 'public.offer_extraction_results', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.offer_extraction_results', 'updated_at', 'insert'),
  'authenticated users only have intended result table and column privileges'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select id from public.offer_extraction_results limit 1$$,
  '42501',
  null,
  'anonymous users cannot read extraction results'
);
select throws_ok(
  $$insert into public.offer_extraction_results (offer_id, result, model, latency_ms) values ('aaaaaaaa-0000-4000-8000-000000000002', '{}', 'model', 1)$$,
  '42501',
  null,
  'anonymous users cannot insert extraction results'
);
select throws_ok(
  $$update public.offer_extraction_results set model = 'anon update' where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  '42501',
  null,
  'anonymous users cannot update extraction results'
);
select throws_ok(
  $$delete from public.offer_extraction_results where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  '42501',
  null,
  'anonymous users cannot delete extraction results'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select results_eq(
  $$select id from public.offer_extraction_results order by created_at, id$$,
  $$
    values
      ('aaaaaaaa-1111-4000-8000-000000000001'::uuid),
      ('aaaaaaaa-1111-4000-8000-000000000003'::uuid)
  $$,
  'buyer A can read only buyer A extraction results'
);

select lives_ok(
  $$
    insert into public.offer_extraction_results (offer_id, result, model, latency_ms)
    values (
      'aaaaaaaa-0000-4000-8000-000000000002',
      '{"answeredQuestions":[],"unansweredQuestions":[],"doubtfulFacts":[],"unmappedFacts":[]}'::jsonb,
      'openrouter/new-model',
      300
    )
  $$,
  'buyer A can insert one result for buyer A offer'
);
select results_eq(
  $$
    select buyer_id, status, model, latency_ms
    from public.offer_extraction_results
    where offer_id = 'aaaaaaaa-0000-4000-8000-000000000002'
  $$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'completed', 'openrouter/new-model', 300)$$,
  'buyer A insert uses their identity and completed status'
);

select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, result, model, latency_ms)
    values ('bbbbbbbb-0000-4000-8000-000000000001', '{}', 'openrouter/model', 1)
  $$,
  '23514',
  null,
  'buyer A cannot insert a result for buyer B offer'
);
select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, buyer_id, result, model, latency_ms)
    values ('aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{}', 'openrouter/model', 1)
  $$,
  '42501',
  null,
  'buyer A cannot spoof buyer_id'
);
select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, result, model, latency_ms)
    values ('aaaaaaaa-0000-4000-8000-000000000002', '{}', 'openrouter/duplicate', 1)
  $$,
  '23505',
  null,
  'duplicate result for the same offer is rejected'
);
select throws_ok(
  $$update public.offer_extraction_results set model = 'owner update' where offer_id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'owner update is denied'
);
select throws_ok(
  $$delete from public.offer_extraction_results where offer_id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'owner direct delete is denied'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select results_eq(
  $$select id from public.offer_extraction_results$$,
  $$values ('bbbbbbbb-1111-4000-8000-000000000001'::uuid)$$,
  'buyer B can read only buyer B extraction results'
);
select throws_ok(
  $$update public.offer_extraction_results set model = 'cross-buyer update' where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  '42501',
  null,
  'buyer B cannot update buyer A extraction results'
);
select throws_ok(
  $$delete from public.offer_extraction_results where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  '42501',
  null,
  'buyer B cannot delete buyer A extraction results'
);

reset role;

select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, buyer_id, status, result, model, latency_ms)
    values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pending', '{}', 'openrouter/model', 1)
  $$,
  '23514',
  null,
  'non-completed status is rejected'
);
select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, buyer_id, result, model, latency_ms)
    values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, 'openrouter/model', 1)
  $$,
  '23502',
  null,
  'null completed result is rejected'
);
select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, buyer_id, result, model, latency_ms)
    values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '[]', 'openrouter/model', 1)
  $$,
  '23514',
  null,
  'non-object result is rejected'
);
select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, buyer_id, result, model, latency_ms)
    values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}', '   ', 1)
  $$,
  '23514',
  null,
  'blank model is rejected'
);
select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, buyer_id, result, model, latency_ms)
    values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}', 'openrouter/model', -1)
  $$,
  '23514',
  null,
  'negative latency is rejected'
);
select throws_ok(
  $$
    insert into public.offer_extraction_results (offer_id, buyer_id, result, model, latency_ms)
    values ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}', 'openrouter/model', 1)
  $$,
  '23514',
  null,
  'database invariant rejects buyer and offer owner mismatch'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$delete from public.flat_offers where id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  'owner can delete an offer with an extraction result'
);
select is_empty(
  $$select id from public.offer_extraction_results where offer_id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  'deleting an offer cascades to its extraction result'
);

reset role;

select lives_ok(
  $$delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'buyer A account can be deleted'
);
select is_empty(
  $$select id from public.offer_extraction_results where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'deleting buyer A cascades to their extraction results'
);
select results_eq(
  $$select count(*) from public.offer_extraction_results where buyer_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  $$values (1::bigint)$$,
  'deleting buyer A does not affect buyer B extraction results'
);

select * from finish();

rollback;
