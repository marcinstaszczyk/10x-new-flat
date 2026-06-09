import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import type { ExtractionRequestInput } from "@/types";
import { DEFAULT_EXTRACTION_MODEL, EXTRACTION_TIMEOUT_MS, validateExtractionInput } from "./extraction-contract";
import { callOpenRouterExtraction, extractionFailure, type ExtractionServiceResult } from "./extraction-provider";

export {
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_TIMEOUT_MS,
  MAX_EXTRACTION_BUCKET_ITEMS,
  MAX_EXTRACTION_OUTPUT_TOKENS,
  MAX_EXTRACTION_QUESTIONS,
  MAX_EXTRACTION_TEXT_LENGTH,
  MAX_OFFER_CONTENT_CHARACTERS,
  buildOpenRouterRequest,
  extractionResultSchema,
  validateExtractionInput,
} from "./extraction-contract";
export { parseExtractionContent, type ExtractionMetadata, type ExtractionServiceResult } from "./extraction-provider";

export interface ExtractionServiceOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export async function extractOfferPreparation(
  input: ExtractionRequestInput,
  options: ExtractionServiceOptions = {},
): Promise<ExtractionServiceResult> {
  const startedAt = Date.now();
  const model = resolveModel(options.model);
  const inputFailure = validateExtractionInput(input);

  if (inputFailure) {
    return extractionFailure("input_too_large", inputFailure, model, startedAt);
  }

  const apiKey = options.apiKey ?? OPENROUTER_API_KEY;

  if (!apiKey) {
    return extractionFailure("configuration", "OPENROUTER_API_KEY is not configured.", model, startedAt);
  }

  return callOpenRouterExtraction(input, {
    apiKey,
    fetcher: options.fetcher ?? fetch,
    model,
    startedAt,
    timeoutMs: options.timeoutMs ?? EXTRACTION_TIMEOUT_MS,
  });
}

function resolveModel(model?: string): string {
  return model ?? OPENROUTER_MODEL ?? DEFAULT_EXTRACTION_MODEL;
}
