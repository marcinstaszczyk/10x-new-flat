import type { ReviewFixture } from "./types.ts";

export const REQUIRED_FINDING_IDS = [
  "cross-buyer-update-policy",
  "destructive-preparation-regeneration",
  "stored-xss-in-evidence",
] as const;

export const offerEditRegenerationFixture: ReviewFixture = {
  id: "offer-edit-regeneration",
  title: "Allow buyers to edit offers and regenerate preparation",
  description:
    "Buyers can correct saved offer details and regenerate viewing preparation when source material changes.",
  rubricPath: "rubrics/offer-edit-regeneration.md",
  diff: `diff --git a/src/pages/api/offers/[id]/edit.ts b/src/pages/api/offers/[id]/edit.ts
new file mode 100644
index 0000000..adf9142
--- /dev/null
+++ b/src/pages/api/offers/[id]/edit.ts
@@ -0,0 +1,42 @@
+import type { APIRoute } from "astro";
+import { z } from "zod";
+import { updateSavedOffer } from "@/lib/services/offers";
+import { createClient } from "@/lib/supabase";
+
+export const prerender = false;
+
+const paramsSchema = z.object({ id: z.uuid() });
+const bodySchema = z.object({ title: z.string().min(1), pastedContent: z.string().min(1) });
+
+export const POST: APIRoute = async (context) => {
+  if (!context.locals.user) return Response.json({ status: "unauthorized" }, { status: 401 });
+
+  const params = paramsSchema.safeParse(context.params);
+  const body = bodySchema.safeParse(await context.request.json());
+  if (!params.success || !body.success) return Response.json({ status: "invalid_input" }, { status: 400 });
+
+  const supabase = createClient(context.request.headers, context.cookies);
+  if (!supabase) return Response.json({ status: "configuration" }, { status: 500 });
+
+  const result = await updateSavedOffer(supabase, params.data.id, body.data);
+  return Response.json({ status: result.ok ? "updated" : "not_found" }, { status: result.ok ? 200 : 404 });
+};
diff --git a/src/lib/services/offers.ts b/src/lib/services/offers.ts
index 22a74cd..91b6f04 100644
--- a/src/lib/services/offers.ts
+++ b/src/lib/services/offers.ts
@@ -78,6 +78,25 @@ export async function loadSavedOffer(client: OfferClient, offerId: string): Prom
   };
 }
+
+export async function updateSavedOffer(
+  client: OfferClient,
+  offerId: string,
+  input: { title: string; pastedContent: string },
+) {
+  const { data, error } = await client
+    .from("flat_offers")
+    .update({ title: input.title, pasted_content: input.pastedContent })
+    .eq("id", offerId)
+    .select("id")
+    .maybeSingle();
+
+  if (error || !data) return { ok: false };
+  return { ok: true };
+}
diff --git a/src/lib/services/offer-extraction-results.ts b/src/lib/services/offer-extraction-results.ts
index 6a5ef0c..ca815f2 100644
--- a/src/lib/services/offer-extraction-results.ts
+++ b/src/lib/services/offer-extraction-results.ts
@@ -70,6 +70,16 @@ export async function createOfferExtractionResult(
   };
 }
+
+export async function deleteOfferExtractionResult(client: OfferExtractionResultClient, offerId: string) {
+  const { error } = await client.from("offer_extraction_results").delete().eq("offer_id", offerId);
+  return { ok: !error };
+}
diff --git a/src/lib/services/offer-preparation.ts b/src/lib/services/offer-preparation.ts
index 4ec01c4..7ca9f91 100644
--- a/src/lib/services/offer-preparation.ts
+++ b/src/lib/services/offer-preparation.ts
@@ -4,7 +4,7 @@ import type { Database, ExtractionRequestInput, OfferExtractionResult } from "@/types";
 import { extractOfferPreparation } from "./extraction";
 import type { ExtractionFailureReason, ExtractionMetadata, ExtractionServiceResult } from "./extraction-provider";
-import { createOfferExtractionResult, loadOfferExtractionResult } from "./offer-extraction-results";
+import { createOfferExtractionResult, deleteOfferExtractionResult, loadOfferExtractionResult } from "./offer-extraction-results";
@@ -42,15 +42,14 @@ export async function prepareOfferViewing(
     return { ok: false, reason: "storage" };
   }
 
-  if (existingResult.result) {
-    return { ok: false, reason: "already_exists" };
+  if (existingResult.result && !(await deleteOfferExtractionResult(client, offerId)).ok) {
+    return { ok: false, reason: "storage" };
   }
 
   const questionResult = await loadBuyerQuestionBase(client);
   if (!questionResult.ok) return { ok: false, reason: "question_base" };
 
   const extractionResult = await extractor({ offer: offerResult.offer, questions: questionResult.questions });
   if (!extractionResult.ok) return { ok: false, reason: extractionResult.reason };
 
diff --git a/supabase/migrations/20260726120000_allow_offer_edits.sql b/supabase/migrations/20260726120000_allow_offer_edits.sql
new file mode 100644
index 0000000..0b72a8a
--- /dev/null
+++ b/supabase/migrations/20260726120000_allow_offer_edits.sql
@@ -0,0 +1,30 @@
+drop policy "Buyers can read their own flat offers" on public.flat_offers;
+create policy "Authenticated buyers can read any flat offer"
+on public.flat_offers for select to authenticated
+using (true);
+
+drop policy "Buyers cannot update flat offers" on public.flat_offers;
+grant update (title, pasted_content) on table public.flat_offers to authenticated;
+create policy "Buyers can edit flat offers"
+on public.flat_offers for update to authenticated
+using (true)
+with check (true);
+
+drop policy "Buyers cannot delete offer extraction results" on public.offer_extraction_results;
+grant delete on table public.offer_extraction_results to authenticated;
+create policy "Buyers can delete their own offer extraction results"
+on public.offer_extraction_results for delete to authenticated
+using ((select auth.uid()) = buyer_id);
diff --git a/src/components/offers/OfferPreparationResult.astro b/src/components/offers/OfferPreparationResult.astro
index 260c98b..b51074e 100644
--- a/src/components/offers/OfferPreparationResult.astro
+++ b/src/components/offers/OfferPreparationResult.astro
@@ -108,7 +108,7 @@ const confidenceLabels: Record<AnsweredExtractionQuestion["confidence"], string>
                   </div>
                   <p class="mt-3 text-sm text-slate-800">{item.answerText}</p>
-                  <p class="mt-2 text-xs leading-5 text-slate-500">Źródło: {item.evidenceText}</p>
+                  <p class="mt-2 text-xs leading-5 text-slate-500" set:html={item.evidenceText} />
                 </article>
               ))}
             </div>`,
  expected: {
    verdict: "fail",
    scoreCeilings: {
      implementationCorrectness: 4,
      testRiskCoverage: 4,
      securitySafety: 4,
    },
    findings: [
      {
        id: "cross-buyer-update-policy",
        description:
          "Permissive SELECT and UPDATE policies let any authenticated buyer select and modify another buyer's offer.",
      },
      {
        id: "destructive-preparation-regeneration",
        description:
          "Regeneration deletes the valid extraction before the extractor and replacement insert succeed, permanently losing it on later failure.",
      },
      {
        id: "stored-xss-in-evidence",
        description:
          "Persisted extractor evidence is rendered with Astro set:html, allowing stored untrusted HTML to execute in a buyer session.",
      },
    ],
  },
};
