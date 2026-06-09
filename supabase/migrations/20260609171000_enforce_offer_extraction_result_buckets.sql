alter table public.offer_extraction_results
  add constraint offer_extraction_results_result_buckets check (
    result ? 'answeredQuestions'
    and result ? 'unansweredQuestions'
    and result ? 'doubtfulFacts'
    and result ? 'unmappedFacts'
    and
    jsonb_typeof(result -> 'answeredQuestions') = 'array'
    and jsonb_typeof(result -> 'unansweredQuestions') = 'array'
    and jsonb_typeof(result -> 'doubtfulFacts') = 'array'
    and jsonb_typeof(result -> 'unmappedFacts') = 'array'
  );
