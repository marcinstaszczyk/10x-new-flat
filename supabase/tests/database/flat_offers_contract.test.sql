begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

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
    'https://example.com/a',
    'Buyer A pasted content'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Buyer B offer',
    null,
    'Buyer B pasted content'
  );

select has_table('public', 'flat_offers', 'flat_offers exists');

select ok(
  (
    select count(*) = 7
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'flat_offers'
      and column_name in (
        'id',
        'buyer_id',
        'title',
        'source_url',
        'pasted_content',
        'created_at',
        'updated_at'
      )
  ),
  'flat_offers has the expected columns'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.flat_offers'::regclass),
  true,
  'flat_offers has RLS enabled'
);

select ok(
  (
    select count(*) = 5
    from pg_constraint
    where conname in (
      'flat_offers_buyer_id_fkey',
      'flat_offers_pkey',
      'flat_offers_title_not_blank',
      'flat_offers_source_url_not_blank',
      'flat_offers_pasted_content_not_blank'
    )
  ),
  'flat_offers ownership and content constraints exist'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'flat_offers'
      and indexname = 'flat_offers_buyer_updated_at_idx'
  ),
  'flat_offers has an owner-scoped newest-updated index'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.set_flat_offers_updated_at()'::regprocedure
  ),
  'flat_offers updated-at trigger function exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'set_flat_offers_updated_at'
      and tgrelid = 'public.flat_offers'::regclass
  ),
  'flat_offers updated-at trigger exists'
);

select ok(
  (
    select count(*) = 4
      and count(*) filter (where cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) = 4
    from pg_policies
    where schemaname = 'public'
      and tablename = 'flat_offers'
  ),
  'flat_offers has explicit policies for select, insert, update, and delete'
);

select ok(
  not has_table_privilege('anon', 'public.flat_offers', 'select')
    and not has_table_privilege('anon', 'public.flat_offers', 'insert')
    and not has_table_privilege('anon', 'public.flat_offers', 'update')
    and not has_table_privilege('anon', 'public.flat_offers', 'delete'),
  'anonymous users have no flat_offers table privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.flat_offers', 'select')
    and has_table_privilege('authenticated', 'public.flat_offers', 'delete')
    and not has_table_privilege('authenticated', 'public.flat_offers', 'update')
    and has_column_privilege('authenticated', 'public.flat_offers', 'title', 'insert')
    and has_column_privilege('authenticated', 'public.flat_offers', 'source_url', 'insert')
    and has_column_privilege('authenticated', 'public.flat_offers', 'pasted_content', 'insert')
    and not has_column_privilege('authenticated', 'public.flat_offers', 'buyer_id', 'insert')
    and not has_column_privilege('authenticated', 'public.flat_offers', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.flat_offers', 'updated_at', 'insert'),
  'authenticated users only have intended table and column privileges'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select id from public.flat_offers limit 1$$,
  '42501',
  null,
  'anonymous users cannot read offers'
);
select throws_ok(
  $$insert into public.flat_offers (title, pasted_content) values ('Anon offer', 'Anon content')$$,
  '42501',
  null,
  'anonymous users cannot insert offers'
);
select throws_ok(
  $$update public.flat_offers set title = 'Anon update' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'anonymous users cannot update offers'
);
select throws_ok(
  $$delete from public.flat_offers where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'anonymous users cannot delete offers'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select results_eq(
  $$select id from public.flat_offers order by title$$,
  $$values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid)$$,
  'buyer A can read only buyer A offers'
);

select lives_ok(
  $$insert into public.flat_offers (title, source_url, pasted_content) values ('Buyer A inserted offer', 'https://example.com/new', 'Inserted pasted content')$$,
  'buyer A can insert a valid offer'
);
select results_eq(
  $$
    select buyer_id, title, source_url, pasted_content
    from public.flat_offers
    where title = 'Buyer A inserted offer'
  $$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'Buyer A inserted offer', 'https://example.com/new', 'Inserted pasted content')$$,
  'buyer A insert uses their identity'
);

select throws_ok(
  $$insert into public.flat_offers (buyer_id, title, pasted_content) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Spoofed buyer', 'Spoofed buyer content')$$,
  '42501',
  null,
  'buyer A cannot insert client-controlled buyer_id'
);
select throws_ok(
  $$insert into public.flat_offers (created_at, title, pasted_content) values ('2000-01-01 00:00:00+00'::timestamptz, 'Spoofed created_at', 'Spoofed created_at content')$$,
  '42501',
  null,
  'buyer A cannot insert client-controlled created_at'
);
select throws_ok(
  $$insert into public.flat_offers (updated_at, title, pasted_content) values ('2000-01-01 00:00:00+00'::timestamptz, 'Spoofed updated_at', 'Spoofed updated_at content')$$,
  '42501',
  null,
  'buyer A cannot insert client-controlled updated_at'
);

select throws_ok(
  $$insert into public.flat_offers (title, pasted_content) values ('   ', 'Nonblank content')$$,
  '23514',
  null,
  'blank title is rejected'
);
select throws_ok(
  $$insert into public.flat_offers (title, pasted_content) values ('Nonblank title', '   ')$$,
  '23514',
  null,
  'blank pasted content is rejected'
);
select throws_ok(
  $$insert into public.flat_offers (title, source_url, pasted_content) values ('Blank URL offer', '   ', 'Nonblank content')$$,
  '23514',
  null,
  'blank source_url is rejected'
);
select lives_ok(
  $$insert into public.flat_offers (title, source_url, pasted_content) values ('Null URL offer', null, 'Nonblank content')$$,
  'null source_url is accepted'
);

select throws_ok(
  $$update public.flat_offers set title = 'Owner update' where title = 'Buyer A inserted offer'$$,
  '42501',
  null,
  'owner update is denied'
);
select throws_ok(
  $$update public.flat_offers set title = 'Cross-buyer update' where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'buyer A cannot update buyer B offers'
);
select is_empty(
  $$delete from public.flat_offers where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning id$$,
  'buyer A cannot delete buyer B offers'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select results_eq(
  $$select id from public.flat_offers order by title$$,
  $$values ('bbbbbbbb-0000-4000-8000-000000000001'::uuid)$$,
  'buyer B can read only buyer B offers'
);
select throws_ok(
  $$update public.flat_offers set title = 'Buyer B update' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'buyer B cannot update buyer A offers'
);
select is_empty(
  $$delete from public.flat_offers where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id$$,
  'buyer B cannot delete buyer A offers'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$delete from public.flat_offers where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'owner can delete their own offer'
);
select is_empty(
  $$select id from public.flat_offers where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'owner delete hard-deletes the row'
);

reset role;

insert into public.flat_offers (
  id,
  buyer_id,
  title,
  source_url,
  pasted_content
)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000099',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Buyer A cascade offer',
    null,
    'Buyer A cascade content'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000099',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Buyer B retained offer',
    null,
    'Buyer B retained content'
  );

select lives_ok(
  $$delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'buyer A account can be deleted'
);
select is_empty(
  $$select id from public.flat_offers where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'deleting buyer A cascades to their offers'
);
select results_eq(
  $$select count(*) from public.flat_offers where buyer_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  $$values (2::bigint)$$,
  'deleting buyer A does not affect buyer B offers'
);

select * from finish();

rollback;
