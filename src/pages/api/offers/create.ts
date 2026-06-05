import type { APIRoute } from "astro";
import { z } from "zod";
import { createSavedOffer } from "@/lib/services/offers";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const createOfferSchema = z.object({
  title: z.string().trim().min(1),
  sourceUrl: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.url().nullable()),
  pastedContent: z.string().trim().min(1),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin", 303);
  }

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return redirectToCreate(context);
  }

  const result = createOfferSchema.safeParse({
    title: formData.get("title"),
    sourceUrl: formData.get("sourceUrl"),
    pastedContent: formData.get("pastedContent"),
  });

  if (!result.success) {
    return redirectToCreate(context);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectToCreate(context);
  }

  const createResult = await createSavedOffer(supabase, result.data);
  if (!createResult.ok) {
    return redirectToCreate(context);
  }

  return context.redirect(`/offers/${createResult.offer.id}?created=success`, 303);
};

function redirectToCreate(context: Parameters<APIRoute>[0]) {
  return context.redirect("/offers/new?save=error", 303);
}
