begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select results_eq(
  'select count(*) from public.question_templates',
  array[88::bigint],
  'the canonical template document contains all 88 rows'
);

select is_empty(
  $$select id from public.question_templates where length(btrim(text)) = 0$$,
  'template text is never blank'
);

select is_empty(
  $$select lower(btrim(text)) from public.question_templates group by lower(btrim(text)) having count(*) > 1$$,
  'template text has no duplicates'
);

select is_empty(
  $$select id from public.question_templates where question_type not in ('category', 'open_question')$$,
  'templates use only allowed question types'
);

select results_eq(
  'select count(position) from public.question_templates',
  'select count(distinct position) from public.question_templates',
  'template positions are unique'
);

select is_empty(
  $$select id from public.question_templates where not is_active$$,
  'all initial templates are active'
);

select results_eq(
  $$select question_type::text, count(*) from public.question_templates group by question_type order by question_type::text$$,
  $$values ('category', 8::bigint), ('open_question', 80::bigint)$$,
  'the document contains category and open-question rows'
);

select results_eq(
  $$select text from public.question_templates where question_type = 'category' order by position$$,
  $$values
    ('Stan prawny i dokumenty'),
    ('Budynek i otoczenie'),
    ('Lokal i układ'),
    ('Stan techniczny i instalacje'),
    ('Koszty i zarządzanie'),
    ('Remonty i wyposażenie'),
    ('Komunikacja, infrastruktura i codzienne użytkowanie'),
    ('Warunki sprzedaży i kolejne kroki')
  $$,
  'the document covers every required content section'
);

select results_eq(
  $$select min(position), max(position) from public.question_templates$$,
  $$values (0, 87)$$,
  'template positions form the expected deterministic range'
);

select * from finish();

rollback;
