import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SavedOffer } from "@/types";

type OfferClient = SupabaseClient<Database>;

type FlatOfferRow = Pick<
  Database["public"]["Tables"]["flat_offers"]["Row"],
  "id" | "title" | "source_url" | "pasted_content" | "created_at" | "updated_at"
>;

export type OfferListResult =
  | {
      ok: true;
      offers: SavedOffer[];
    }
  | {
      ok: false;
    };

export type OfferDetailResult =
  | {
      ok: true;
      offer: SavedOffer | null;
    }
  | {
      ok: false;
    };

export interface CreateOfferInput {
  title: string;
  sourceUrl: string | null;
  pastedContent: string;
}

export type CreateOfferResult =
  | {
      ok: true;
      offer: SavedOffer;
    }
  | {
      ok: false;
    };

export type DeleteOfferResult = { ok: true } | { ok: false };

export async function listSavedOffers(client: OfferClient): Promise<OfferListResult> {
  const { data, error } = await client
    .from("flat_offers")
    .select("id, title, source_url, pasted_content, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .overrideTypes<FlatOfferRow[], { merge: false }>();

  if (error) {
    return { ok: false };
  }

  return {
    ok: true,
    offers: data.map(mapSavedOffer),
  };
}

export async function createSavedOffer(client: OfferClient, input: CreateOfferInput): Promise<CreateOfferResult> {
  const { data, error } = await client
    .from("flat_offers")
    .insert({
      title: input.title,
      source_url: input.sourceUrl,
      pasted_content: input.pastedContent,
    })
    .select("id, title, source_url, pasted_content, created_at, updated_at")
    .single()
    .overrideTypes<FlatOfferRow, { merge: false }>();

  if (error) {
    return { ok: false };
  }

  return {
    ok: true,
    offer: mapSavedOffer(data),
  };
}

export async function loadSavedOffer(client: OfferClient, offerId: string): Promise<OfferDetailResult> {
  const { data, error } = await client
    .from("flat_offers")
    .select("id, title, source_url, pasted_content, created_at, updated_at")
    .eq("id", offerId)
    .maybeSingle()
    .overrideTypes<FlatOfferRow | null, { merge: false }>();

  if (error) {
    return { ok: false };
  }

  return {
    ok: true,
    offer: data ? mapSavedOffer(data) : null,
  };
}

export async function deleteSavedOffer(client: OfferClient, offerId: string): Promise<DeleteOfferResult> {
  const { data, error } = await client.from("flat_offers").delete().eq("id", offerId).select("id");

  if (error || data.length !== 1) {
    return { ok: false };
  }

  return { ok: true };
}

function mapSavedOffer(row: FlatOfferRow): SavedOffer {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    pastedContent: row.pasted_content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
