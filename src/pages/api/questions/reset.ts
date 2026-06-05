import type { APIRoute } from "astro";
import { z } from "zod";
import { resetBuyerQuestionBase } from "@/lib/services/questions";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const resetQuestionBaseSchema = z.object({
  confirmation: z.literal("reset-question-base"),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin", 303);
  }

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return redirectToDashboard(context, "error");
  }

  const result = resetQuestionBaseSchema.safeParse({
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return redirectToDashboard(context, "error");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectToDashboard(context, "error");
  }

  const resetResult = await resetBuyerQuestionBase(supabase);
  return redirectToDashboard(context, resetResult.ok ? "success" : "error");
};

function redirectToDashboard(context: Parameters<APIRoute>[0], reset: "success" | "error") {
  return context.redirect(`/dashboard?reset=${reset}`, 303);
}
