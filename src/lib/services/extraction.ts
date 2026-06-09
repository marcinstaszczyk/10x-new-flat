import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import type { ExtractionRequestInput, ExtractionResult } from "@/types";
import {
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_TIMEOUT_MS,
  buildOpenRouterRequest,
  extractionResultSchema,
  validateExtractionInput,
} from "./extraction-contract";

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

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

type ExtractionFailureReason = "configuration" | "input_too_large" | "timeout" | "provider" | "invalid_output";

export type ExtractionServiceResult =
  | {
      ok: true;
      result: ExtractionResult;
      metadata: ExtractionMetadata;
    }
  | {
      ok: false;
      reason: ExtractionFailureReason;
      diagnostic: string;
      metadata: ExtractionMetadata;
    };

export interface ExtractionMetadata {
  model: string;
  latencyMs: number;
}

export interface ExtractionServiceOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

interface OpenRouterCompletionResponse {
  choices?: {
    message?: {
      content?: string | null;
    };
    error?: {
      message?: string;
    };
  }[];
  error?: {
    message?: string;
  };
}

export async function extractOfferPreparation(
  input: ExtractionRequestInput,
  options: ExtractionServiceOptions = {},
): Promise<ExtractionServiceResult> {
  const startedAt = Date.now();
  const model = resolveModel(options.model);
  const inputFailure = validateExtractionInput(input);

  if (inputFailure) {
    return failure("input_too_large", inputFailure, model, startedAt);
  }

  const apiKey = options.apiKey ?? OPENROUTER_API_KEY;

  if (!apiKey) {
    return failure("configuration", "OPENROUTER_API_KEY is not configured.", model, startedAt);
  }

  return callOpenRouter(input, {
    apiKey,
    fetcher: options.fetcher ?? fetch,
    model,
    startedAt,
    timeoutMs: options.timeoutMs ?? EXTRACTION_TIMEOUT_MS,
  });
}

export function parseExtractionContent(content: string, metadata: ExtractionMetadata): ExtractionServiceResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return invalidOutput("OpenRouter response content was not valid JSON.", metadata);
  }

  const result = extractionResultSchema.safeParse(parsed);

  if (!result.success) {
    return invalidOutput("OpenRouter JSON did not match the extraction schema.", metadata);
  }

  return { ok: true, result: result.data, metadata };
}

interface OpenRouterCallInput {
  apiKey: string;
  fetcher: typeof fetch;
  model: string;
  startedAt: number;
  timeoutMs: number;
}

async function callOpenRouter(
  input: ExtractionRequestInput,
  callInput: OpenRouterCallInput,
): Promise<ExtractionServiceResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, callInput.timeoutMs);

  try {
    const response = await callInput.fetcher(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${callInput.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildOpenRouterRequest(input, callInput.model)),
      signal: controller.signal,
    });

    return await handleOpenRouterResponse(response, callInput.model, callInput.startedAt);
  } catch (error) {
    return handleOpenRouterError(error, callInput.model, callInput.startedAt);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleOpenRouterResponse(
  response: Response,
  model: string,
  startedAt: number,
): Promise<ExtractionServiceResult> {
  const metadata = buildMetadata(model, startedAt);

  if (!response.ok) {
    return failure("provider", `OpenRouter request failed with status ${response.status}.`, model, startedAt);
  }

  const payload = (await response.json()) as OpenRouterCompletionResponse;
  if (hasProviderError(payload)) {
    return failure("provider", "OpenRouter returned a provider error.", model, startedAt);
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    return invalidOutput("OpenRouter response did not include message content.", metadata);
  }

  return parseExtractionContent(content, metadata);
}

function handleOpenRouterError(error: unknown, model: string, startedAt: number): ExtractionServiceResult {
  if (isAbortError(error)) {
    return failure("timeout", "OpenRouter request timed out.", model, startedAt);
  }

  return failure("provider", "OpenRouter request could not be completed.", model, startedAt);
}

function resolveModel(model?: string): string {
  return model ?? OPENROUTER_MODEL ?? DEFAULT_EXTRACTION_MODEL;
}

function hasProviderError(payload: OpenRouterCompletionResponse): boolean {
  return Boolean(payload.error?.message ?? payload.choices?.[0]?.error?.message);
}

function invalidOutput(diagnostic: string, metadata: ExtractionMetadata): ExtractionServiceResult {
  return { ok: false, reason: "invalid_output", diagnostic, metadata };
}

function failure(
  reason: ExtractionFailureReason,
  diagnostic: string,
  model: string,
  startedAt: number,
): ExtractionServiceResult {
  return { ok: false, reason, diagnostic, metadata: buildMetadata(model, startedAt) };
}

function buildMetadata(model: string, startedAt: number): ExtractionMetadata {
  return { model, latencyMs: Date.now() - startedAt };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
