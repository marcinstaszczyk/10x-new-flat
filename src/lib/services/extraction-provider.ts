import type { ExtractionQuestionInput, ExtractionRequestInput, ExtractionResult } from "@/types";
import { EXTRACTION_TIMEOUT_MS, buildOpenRouterRequest, extractionResultSchema } from "./extraction-contract.ts";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ExtractionFailureReason = "configuration" | "input_too_large" | "timeout" | "provider" | "invalid_output";

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

export interface OpenRouterExtractionOptions {
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
  startedAt?: number;
  timeoutMs?: number;
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

export async function callOpenRouterExtraction(
  input: ExtractionRequestInput,
  options: OpenRouterExtractionOptions,
): Promise<ExtractionServiceResult> {
  const startedAt = options.startedAt ?? Date.now();
  const timeoutMs = options.timeoutMs ?? EXTRACTION_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await (options.fetcher ?? fetch)(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildOpenRouterRequest(input, options.model)),
      signal: controller.signal,
    });

    return await handleOpenRouterResponse(response, options.model, startedAt, input.questions);
  } catch (error) {
    return handleOpenRouterError(error, options.model, startedAt);
  } finally {
    clearTimeout(timeoutId);
  }
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

  return { ok: true, result: { ...result.data, unansweredQuestions: [] }, metadata };
}

export function extractionFailure(
  reason: ExtractionFailureReason,
  diagnostic: string,
  model: string,
  startedAt: number,
): ExtractionServiceResult {
  return { ok: false, reason, diagnostic, metadata: buildMetadata(model, startedAt) };
}

async function handleOpenRouterResponse(
  response: Response,
  model: string,
  startedAt: number,
  questions: ExtractionQuestionInput[],
): Promise<ExtractionServiceResult> {
  const metadata = buildMetadata(model, startedAt);

  if (!response.ok) {
    return extractionFailure("provider", `OpenRouter request failed with status ${response.status}.`, model, startedAt);
  }

  const payload = (await response.json()) as OpenRouterCompletionResponse;
  if (hasProviderError(payload)) {
    return extractionFailure("provider", "OpenRouter returned a provider error.", model, startedAt);
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    return invalidOutput("OpenRouter response did not include message content.", metadata);
  }

  return parseExtractionContentForQuestions(content, metadata, questions);
}

function parseExtractionContentForQuestions(
  content: string,
  metadata: ExtractionMetadata,
  questions: ExtractionQuestionInput[],
): ExtractionServiceResult {
  const result = parseExtractionContent(content, metadata);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    result: completeUnansweredQuestions(result.result, questions),
    metadata,
  };
}

function completeUnansweredQuestions(result: ExtractionResult, questions: ExtractionQuestionInput[]): ExtractionResult {
  const answeredQuestions = result.answeredQuestions.filter(hasSubstantiveAnswer);
  const mappedQuestionIds = new Set(answeredQuestions.map((question) => question.questionId));
  for (const fact of result.doubtfulFacts) {
    if (fact.relatedQuestionId) {
      mappedQuestionIds.add(fact.relatedQuestionId);
    }
  }

  return {
    ...result,
    answeredQuestions,
    unansweredQuestions: questions
      .filter((question) => !mappedQuestionIds.has(question.id))
      .map((question) => ({
        questionId: question.id,
        questionText: question.text,
      })),
  };
}

function hasSubstantiveAnswer(question: ExtractionResult["answeredQuestions"][number]): boolean {
  const answer = question.answerText.toLocaleLowerCase();
  const evidence = question.evidenceText.toLocaleLowerCase();
  const nonAnswerPattern =
    /(?:not specified|not provided|not mentioned|does not mention|doesn't mention|does not include|no information|no explicit|unknown|brak informacji|nie podano|nie wskazano|nie wymieniono)/;

  return !nonAnswerPattern.test(answer) && !nonAnswerPattern.test(evidence);
}

function handleOpenRouterError(error: unknown, model: string, startedAt: number): ExtractionServiceResult {
  if (isAbortError(error)) {
    return extractionFailure("timeout", "OpenRouter request timed out.", model, startedAt);
  }

  return extractionFailure("provider", "OpenRouter request could not be completed.", model, startedAt);
}

function hasProviderError(payload: OpenRouterCompletionResponse): boolean {
  return Boolean(payload.error?.message ?? payload.choices?.[0]?.error?.message);
}

function invalidOutput(diagnostic: string, metadata: ExtractionMetadata): ExtractionServiceResult {
  return { ok: false, reason: "invalid_output", diagnostic, metadata };
}

function buildMetadata(model: string, startedAt: number): ExtractionMetadata {
  return { model, latencyMs: Date.now() - startedAt };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
