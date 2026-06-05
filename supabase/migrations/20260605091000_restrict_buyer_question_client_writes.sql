alter table public.buyer_questions
  alter column buyer_id set default auth.uid();

revoke insert, update on table public.buyer_questions from authenticated;

grant insert (question_type, text, position)
  on table public.buyer_questions to authenticated;

grant update (question_type, text, position)
  on table public.buyer_questions to authenticated;
