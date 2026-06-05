import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuyerQuestion, Database } from "@/types";

type QuestionClient = SupabaseClient<Database>;

type BuyerQuestionRow = Pick<
  Database["public"]["Tables"]["buyer_questions"]["Row"],
  "id" | "source_template_id" | "question_type" | "text" | "position"
>;

export type QuestionBaseResult =
  | {
      ok: true;
      questions: BuyerQuestion[];
    }
  | {
      ok: false;
    };

export type QuestionBaseMutationResult = { ok: true } | { ok: false };

export async function loadBuyerQuestionBase(client: QuestionClient): Promise<QuestionBaseResult> {
  const { error: ensureError } = await client.rpc("ensure_buyer_question_base");

  if (ensureError) {
    return { ok: false };
  }

  const { data, error } = await client
    .from("buyer_questions")
    .select("id, source_template_id, question_type, text, position")
    .order("position", { ascending: true })
    .overrideTypes<BuyerQuestionRow[], { merge: false }>();

  if (error) {
    return { ok: false };
  }

  return {
    ok: true,
    questions: data.map(mapBuyerQuestion),
  };
}

export async function resetBuyerQuestionBase(client: QuestionClient): Promise<QuestionBaseMutationResult> {
  const { error } = await client.rpc("reset_buyer_question_base");

  if (error) {
    return { ok: false };
  }

  return { ok: true };
}

function mapBuyerQuestion(row: BuyerQuestionRow): BuyerQuestion {
  return {
    id: row.id,
    sourceTemplateId: row.source_template_id,
    type: row.question_type,
    text: row.text,
    position: row.position,
  };
}
