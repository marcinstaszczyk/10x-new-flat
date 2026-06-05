begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

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

insert into public.buyer_questions (
  id,
  buyer_id,
  source_template_id,
  question_type,
  text,
  position
)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-0000-0000-000000000001',
    'category',
    'Buyer A category',
    0
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-0000-0000-000000000002',
    'open_question',
    'Buyer A question',
    1
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '10000000-0000-0000-0000-000000000003',
    'open_question',
    'Buyer B question',
    0
  );

update public.question_templates
set is_active = false
where id = '10000000-0000-0000-0000-000000000002';

select has_table('public', 'question_templates', 'question_templates exists');
select has_table('public', 'buyer_questions', 'buyer_questions exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.question_templates'::regclass),
  true,
  'question_templates has RLS enabled'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.buyer_questions'::regclass),
  true,
  'buyer_questions has RLS enabled'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conname in (
      'buyer_questions_buyer_id_fkey',
      'buyer_questions_buyer_position_unique',
      'buyer_questions_position_not_negative',
      'buyer_questions_source_template_id_fkey',
      'buyer_questions_text_not_blank',
      'question_templates_position_not_negative',
      'question_templates_position_unique',
      'question_templates_text_not_blank'
    )
  ),
  8::bigint,
  'ownership, provenance, ordering, and text constraints exist'
);

select ok(
  (
    select count(*) = 5
      and count(*) filter (
        where (tablename = 'buyer_questions' and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))
          or (tablename = 'question_templates' and cmd = 'SELECT')
      ) = 5
    from pg_policies
    where schemaname = 'public'
      and tablename in ('buyer_questions', 'question_templates')
  ),
  'the expected explicit RLS policies exist'
);

select results_eq(
  $$
    select question_type::text, count(*)
    from public.question_templates
    where is_active
    group by question_type
    order by question_type::text
  $$,
  $$values ('category', 8::bigint), ('open_question', 79::bigint)$$,
  'the active template document contains category and open-question rows'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select id from public.question_templates limit 1$$,
  '42501',
  null,
  'anonymous users cannot read templates'
);
select throws_ok(
  $$select id from public.buyer_questions limit 1$$,
  '42501',
  null,
  'anonymous users cannot read buyer questions'
);
select throws_ok(
  $$insert into public.question_templates (question_type, text, position) values ('open_question', 'Anon template', 1000)$$,
  '42501',
  null,
  'anonymous users cannot insert templates'
);
select throws_ok(
  $$update public.question_templates set text = 'Anon update' where position = 0$$,
  '42501',
  null,
  'anonymous users cannot update templates'
);
select throws_ok(
  $$delete from public.question_templates where position = 0$$,
  '42501',
  null,
  'anonymous users cannot delete templates'
);
select throws_ok(
  $$insert into public.buyer_questions (buyer_id, question_type, text, position) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'open_question', 'Anon question', 1000)$$,
  '42501',
  null,
  'anonymous users cannot insert buyer questions'
);
select throws_ok(
  $$update public.buyer_questions set text = 'Anon update' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'anonymous users cannot update buyer questions'
);
select throws_ok(
  $$delete from public.buyer_questions where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'anonymous users cannot delete buyer questions'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select results_eq(
  $$select count(*) from public.question_templates$$,
  $$values (87::bigint)$$,
  'authenticated buyers can read active templates'
);
select is_empty(
  $$select id from public.question_templates where not is_active$$,
  'authenticated buyers cannot read inactive templates'
);
select throws_ok(
  $$insert into public.question_templates (question_type, text, position) values ('open_question', 'Buyer template', 1000)$$,
  '42501',
  null,
  'authenticated buyers cannot insert templates'
);
select throws_ok(
  $$update public.question_templates set text = 'Buyer update' where position = 0$$,
  '42501',
  null,
  'authenticated buyers cannot update templates'
);
select throws_ok(
  $$delete from public.question_templates where position = 0$$,
  '42501',
  null,
  'authenticated buyers cannot delete templates'
);

select results_eq(
  $$select id from public.buyer_questions order by position$$,
  $$
    values
      ('aaaaaaaa-0000-4000-8000-000000000001'::uuid),
      ('aaaaaaaa-0000-4000-8000-000000000002'::uuid)
  $$,
  'buyer A can read only their own questions'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select results_eq(
  $$select id from public.buyer_questions$$,
  $$values ('bbbbbbbb-0000-4000-8000-000000000001'::uuid)$$,
  'buyer B can read only their own questions'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.buyer_questions (question_type, text, position)
    values ('open_question', 'Buyer A inserted question', 2)
  $$,
  'buyer A can insert their own question through database-owned identity'
);
select results_eq(
  $$
    select buyer_id, source_template_id, text
    from public.buyer_questions
    where position = 2
  $$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, null::uuid, 'Buyer A inserted question')$$,
  'buyer A insert uses their identity and has no template provenance'
);
select throws_ok(
  $$
    insert into public.buyer_questions (buyer_id, question_type, text, position)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'open_question', 'Cross-buyer insert', 2)
  $$,
  '42501',
  null,
  'buyer A cannot insert a question for buyer B'
);
select throws_ok(
  $$
    insert into public.buyer_questions (source_template_id, question_type, text, position)
    values ('10000000-0000-0000-0000-000000000001', 'open_question', 'Spoofed provenance', 3)
  $$,
  '42501',
  null,
  'buyer A cannot insert client-controlled template provenance'
);
select throws_ok(
  $$
    insert into public.buyer_questions (created_at, question_type, text, position)
    values ('2000-01-01 00:00:00+00'::timestamptz, 'open_question', 'Spoofed creation time', 3)
  $$,
  '42501',
  null,
  'buyer A cannot insert client-controlled creation timestamps'
);
select lives_ok(
  $$update public.buyer_questions set text = 'Buyer A updated question' where position = 2$$,
  'buyer A can update their own question'
);
select results_eq(
  $$select text from public.buyer_questions where position = 2$$,
  $$values ('Buyer A updated question')$$,
  'buyer A can read their update'
);
select is_empty(
  $$update public.buyer_questions set text = 'Cross-buyer update' where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning id$$,
  'buyer A cannot update buyer B questions'
);
select throws_ok(
  $$update public.buyer_questions set buyer_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'buyer A cannot transfer a question to buyer B'
);
select throws_ok(
  $$update public.buyer_questions set source_template_id = '10000000-0000-0000-0000-000000000001' where position = 2$$,
  '42501',
  null,
  'buyer A cannot rewrite template provenance'
);
select throws_ok(
  $$update public.buyer_questions set updated_at = '2000-01-01 00:00:00+00'::timestamptz where position = 2$$,
  '42501',
  null,
  'buyer A cannot rewrite update timestamps'
);
select is_empty(
  $$delete from public.buyer_questions where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning id$$,
  'buyer A cannot delete buyer B questions'
);
select lives_ok(
  $$delete from public.buyer_questions where position = 2$$,
  'buyer A can delete their own question'
);
select is_empty(
  $$select id from public.buyer_questions where position = 2$$,
  'buyer A deleted question is gone'
);

reset role;

select throws_ok(
  $$delete from public.question_templates where id = '10000000-0000-0000-0000-000000000002'$$,
  '23503',
  null,
  'referenced templates cannot be deleted'
);
select lives_ok(
  $$update public.question_templates set is_active = false where id = '10000000-0000-0000-0000-000000000001'$$,
  'referenced templates can be retired'
);
select results_eq(
  $$
    select source_template_id
    from public.buyer_questions
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'
  $$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid)$$,
  'retiring a template preserves buyer provenance'
);

insert into public.buyer_questions (id, buyer_id, question_type, text, position)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000020',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'category',
    'Temporary category',
    20
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000021',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'open_question',
    'Question after temporary category',
    21
  );

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$delete from public.buyer_questions where id = 'aaaaaaaa-0000-4000-8000-000000000020'$$,
  'buyer A can delete a category row'
);
select results_eq(
  $$
    select id, position
    from public.buyer_questions
    where id = 'aaaaaaaa-0000-4000-8000-000000000021'
  $$,
  $$values ('aaaaaaaa-0000-4000-8000-000000000021'::uuid, 21)$$,
  'deleting a category preserves the following question and position'
);

reset role;

select lives_ok(
  $$delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'buyer A account can be deleted'
);
select is_empty(
  $$select id from public.buyer_questions where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'deleting buyer A cascades to their questions'
);
select results_eq(
  $$select count(*) from public.buyer_questions where buyer_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  $$values (1::bigint)$$,
  'deleting buyer A does not affect buyer B questions'
);

select * from finish();

rollback;
