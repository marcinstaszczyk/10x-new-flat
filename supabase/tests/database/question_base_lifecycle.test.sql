begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

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
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'authenticated',
    'authenticated',
    'buyer-existing@example.com',
    '',
    now(),
    '{}',
    '{}'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'authenticated',
    'authenticated',
    'buyer-legacy@example.com',
    '',
    now(),
    '{}',
    '{}'
  );

update public.question_templates
set is_active = false
where id = '10000000-0000-0000-0000-000000000002';

insert into public.buyer_questions (
  buyer_id,
  question_type,
  text,
  position
)
values
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'open_question',
    'Buyer B sentinel question',
    500
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'open_question',
    'Existing personal question',
    500
  );

select ok(
  not has_function_privilege('anon', 'public.ensure_buyer_question_base()', 'execute'),
  'anonymous users cannot ensure a question base'
);
select ok(
  not has_function_privilege('anon', 'public.reset_buyer_question_base()', 'execute'),
  'anonymous users cannot reset a question base'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';

select throws_ok(
  $$select public.ensure_buyer_question_base()$$,
  '42501',
  'Authentication required',
  'ensure rejects authenticated role without a buyer id'
);
select throws_ok(
  $$select public.reset_buyer_question_base()$$,
  '42501',
  'Authentication required',
  'reset rejects authenticated role without a buyer id'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$select public.ensure_buyer_question_base()$$,
  'a buyer with no rows can initialize their question base'
);
select is(
  (select count(*) from public.buyer_questions),
  (select count(*) from public.question_templates),
  'initialization copies exactly the active template document'
);
select is(
  (
    select count(*)
    from (
      select source_template_id, question_type, text, position
      from public.buyer_questions
      except
      select id, question_type, text, position
      from public.question_templates
    ) mismatched_rows
  ),
  0::bigint,
  'initialization preserves provenance, type, text, and ordering'
);
select is_empty(
  $$
    select id
    from public.buyer_questions
    where source_template_id = '10000000-0000-0000-0000-000000000002'
  $$,
  'initialization excludes inactive templates'
);

create temporary table buyer_a_snapshot as
select id, source_template_id, question_type, text, position
from public.buyer_questions
order by position;

select lives_ok(
  $$select public.ensure_buyer_question_base()$$,
  'a repeated ensure call succeeds'
);
select results_eq(
  $$
    select id, source_template_id, question_type, text, position
    from public.buyer_questions
    order by position
  $$,
  $$
    select id, source_template_id, question_type, text, position
    from buyer_a_snapshot
    order by position
  $$,
  'a repeated ensure call leaves the initialized copy unchanged'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';

select lives_ok(
  $$select public.ensure_buyer_question_base()$$,
  'an existing account can initialize on its first question-base visit'
);
select is(
  (select count(*) from public.buyer_questions),
  (select count(*) from public.question_templates),
  'first-visit initialization works for a pre-existing buyer account'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select lives_ok(
  $$select public.ensure_buyer_question_base()$$,
  'ensure succeeds when the buyer already owns rows'
);
select results_eq(
  $$select text, position from public.buyer_questions order by position$$,
  $$values ('Existing personal question', 500)$$,
  'existing buyer rows make ensure a no-op'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.buyer_questions (
      buyer_id,
      source_template_id,
      question_type,
      text,
      position
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      null,
      'open_question',
      'Buyer A custom reset candidate',
      1000
    )
  $$,
  'buyer A can add a personal row before reset'
);
select lives_ok(
  $$select public.reset_buyer_question_base()$$,
  'reset succeeds for an initialized buyer'
);
select is(
  (select count(*) from public.buyer_questions),
  (select count(*) from public.question_templates),
  'reset recreates exactly the active template document'
);
select is(
  (
    select count(*)
    from (
      select source_template_id, question_type, text, position
      from public.buyer_questions
      except
      select id, question_type, text, position
      from public.question_templates
    ) mismatched_rows
  ),
  0::bigint,
  'reset preserves provenance, type, text, and ordering'
);
select is_empty(
  $$
    select id
    from public.buyer_questions
    where source_template_id is null
       or source_template_id = '10000000-0000-0000-0000-000000000002'
  $$,
  'reset removes personal rows and excludes inactive templates'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select results_eq(
  $$select text, position from public.buyer_questions order by position$$,
  $$values ('Buyer B sentinel question', 500)$$,
  'buyer A reset does not change buyer B rows'
);
select lives_ok(
  $$select public.ensure_buyer_question_base()$$,
  'buyer B ensure succeeds independently'
);
select results_eq(
  $$select text, position from public.buyer_questions order by position$$,
  $$values ('Buyer B sentinel question', 500)$$,
  'buyer B ensure leaves their existing rows unchanged'
);

reset role;

select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.ensure_buyer_question_base()'::regprocedure
  ),
  'ensure lifecycle function exists'
);
select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.reset_buyer_question_base()'::regprocedure
  ),
  'reset lifecycle function exists'
);
select ok(
  not has_function_privilege('anon', 'public.ensure_buyer_question_base()', 'execute')
    and not has_function_privilege('anon', 'public.reset_buyer_question_base()', 'execute')
    and has_function_privilege('authenticated', 'public.ensure_buyer_question_base()', 'execute')
    and has_function_privilege('authenticated', 'public.reset_buyer_question_base()', 'execute'),
  'only authenticated users can execute lifecycle functions'
);

select * from finish();

rollback;
