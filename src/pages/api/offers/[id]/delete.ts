import type { APIRoute } from "astro";
import { z } from "zod";
import { deleteSavedOffer } from "@/lib/services/offers";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const deleteOfferSchema = z.object({
  id: z.uuid(),
  confirmation: z.literal("delete-flat-offer"),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin", 303);
  }

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return redirectToOffer(context);
  }

  const result = deleteOfferSchema.safeParse({
    id: context.params.id,
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return redirectToOffers("error", context);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectToOffer(context);
  }

  const deleteResult = await deleteSavedOffer(supabase, result.data.id);
  if (!deleteResult.ok) {
    return redirectToOffer(context);
  }

  return redirectToOffers("success", context);
};

function redirectToOffer(context: Parameters<APIRoute>[0]) {
  return context.redirect(`/offers/${context.params.id}?deleted=error`, 303);
}

function redirectToOffers(deleted: "success" | "error", context: Parameters<APIRoute>[0]) {
  return context.redirect(`/offers?deleted=${deleted}`, 303);
}
