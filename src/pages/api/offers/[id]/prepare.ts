import type { APIRoute } from "astro";
import { E2E_OPENROUTER_MOCK } from "astro:env/server";
import { z } from "zod";
import { createE2eOpenRouterMockExtractor } from "@/lib/services/e2e-extraction-mock";
import { prepareOfferViewing, type PrepareOfferViewingResult } from "@/lib/services/offer-preparation";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const paramsSchema = z.object({
  id: z.uuid(),
});

type PrepareFailureReason = Exclude<PrepareOfferViewingResult, { ok: true }>["reason"];

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonResponse({ status: "unauthorized" }, 401);
  }

  const params = paramsSchema.safeParse(context.params);
  if (!params.success) {
    return jsonResponse({ status: "invalid_id" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ status: "configuration" }, 500);
  }

  const result = await prepareOfferViewing(supabase, params.data.id, buildPrepareOptions());
  if (result.ok) {
    return jsonResponse(
      {
        status: "completed",
        resultId: result.result.id,
      },
      201,
    );
  }

  return jsonResponse({ status: result.reason }, statusCodeForFailure(result.reason));
};

function statusCodeForFailure(reason: PrepareFailureReason): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "already_exists":
      return 409;
    case "input_too_large":
      return 413;
    case "timeout":
      return 504;
    case "provider":
    case "invalid_output":
      return 502;
    case "configuration":
    case "question_base":
    case "storage":
      return 500;
  }
}

function buildPrepareOptions() {
  if (E2E_OPENROUTER_MOCK !== "true" || !import.meta.env.DEV) {
    return {};
  }

  return {
    extractOfferPreparation: createE2eOpenRouterMockExtractor(),
  };
}

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
