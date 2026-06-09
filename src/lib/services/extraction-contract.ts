import { z } from "zod";
import type { ExtractionRequestInput } from "@/types";

export const DEFAULT_EXTRACTION_MODEL = "openai/gpt-5.5";
export const EXTRACTION_TIMEOUT_MS = 55_000;
export const MAX_OFFER_CONTENT_CHARACTERS = 100_000;
export const MAX_EXTRACTION_QUESTIONS = 200;
export const MAX_EXTRACTION_OUTPUT_TOKENS = 8_000;
export const MAX_EXTRACTION_BUCKET_ITEMS = 250;
export const MAX_EXTRACTION_TEXT_LENGTH = 1_200;

const EXTRACTION_SCHEMA_NAME = "flat_offer_extraction_result";

export const extractionResultSchema = z
  .object({
    answeredQuestions: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(120),
            questionText: z.string().min(1).max(MAX_EXTRACTION_TEXT_LENGTH),
            answerText: z.string().min(1).max(MAX_EXTRACTION_TEXT_LENGTH),
            evidenceText: z.string().min(1).max(MAX_EXTRACTION_TEXT_LENGTH),
            confidence: z.enum(["high", "medium", "low"]),
          })
          .strict(),
      )
      .max(MAX_EXTRACTION_BUCKET_ITEMS),
    doubtfulFacts: z
      .array(
        z
          .object({
            label: z.string().min(1).max(160),
            value: z.string().min(1).max(MAX_EXTRACTION_TEXT_LENGTH).nullable(),
            evidence: z.string().min(1).max(MAX_EXTRACTION_TEXT_LENGTH),
            reason: z.string().min(1).max(MAX_EXTRACTION_TEXT_LENGTH),
            relatedQuestionId: z.string().min(1).max(120).nullable().optional(),
          })
          .strict(),
      )
      .max(MAX_EXTRACTION_BUCKET_ITEMS),
    unmappedFacts: z
      .array(
        z
          .object({
            label: z.string().min(1).max(160),
            value: z.string().min(1).max(MAX_EXTRACTION_TEXT_LENGTH),
            evidence: z.string().min(1).max(MAX_EXTRACTION_TEXT_LENGTH),
          })
          .strict(),
      )
      .max(MAX_EXTRACTION_BUCKET_ITEMS),
  })
  .strict();

export function buildOpenRouterRequest(input: ExtractionRequestInput, model: string): Record<string, unknown> {
  return {
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(input) },
    ],
    reasoning: { effort: "low", exclude: true },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: EXTRACTION_SCHEMA_NAME,
        strict: true,
        schema: buildExtractionJsonSchema(),
      },
    },
    stream: false,
    temperature: 0.1,
    max_tokens: MAX_EXTRACTION_OUTPUT_TOKENS,
  };
}

export function validateExtractionInput(input: ExtractionRequestInput): string | null {
  if (input.offer.pastedContent.length > MAX_OFFER_CONTENT_CHARACTERS) {
    return `Offer content exceeds ${MAX_OFFER_CONTENT_CHARACTERS} characters.`;
  }

  if (input.questions.length > MAX_EXTRACTION_QUESTIONS) {
    return `Question list exceeds ${MAX_EXTRACTION_QUESTIONS} questions.`;
  }

  return null;
}

function buildSystemPrompt(): string {
  return [
    "You extract structured preparation facts from pasted flat-offer content.",
    "Use only the pasted offer content. Do not invent facts, infer missing values, or use outside knowledge.",
    "Map known facts to buyer questions as answered question pairs.",
    "Only answer a buyer question when the pasted offer contains explicit supporting evidence.",
    "If a buyer question has no explicit answer, omit it from answeredQuestions.",
    "It is valid for a buyer question to be absent from every model-generated bucket.",
    "Put suspicious, contradictory, vague, or uncertain values in doubtfulFacts.",
    "Put useful offer facts that do not match any buyer question in unmappedFacts.",
    "Evidence must be a short excerpt or compact summary from the pasted content.",
    "Return only JSON that matches the provided schema.",
  ].join(" ");
}

function buildUserPrompt(input: ExtractionRequestInput): string {
  const questions = input.questions.map((question) => `- ${question.id}: ${question.text}`).join("\n");

  return [
    `Offer ID: ${input.offer.id}`,
    `Offer title: ${input.offer.title}`,
    "",
    "Buyer questions:",
    questions,
    "",
    "Pasted offer content:",
    input.offer.pastedContent,
  ].join("\n");
}

function buildExtractionJsonSchema(): Record<string, unknown> {
  const shortText = { type: "string", minLength: 1, maxLength: MAX_EXTRACTION_TEXT_LENGTH };
  const questionId = { type: "string", minLength: 1, maxLength: 120 };
  const label = { type: "string", minLength: 1, maxLength: 160 };

  return {
    type: "object",
    additionalProperties: false,
    required: ["answeredQuestions", "doubtfulFacts", "unmappedFacts"],
    properties: {
      answeredQuestions: buildAnsweredQuestionsSchema(questionId, shortText),
      doubtfulFacts: buildDoubtfulFactsSchema(questionId, label, shortText),
      unmappedFacts: buildUnmappedFactsSchema(label, shortText),
    },
  };
}

function buildAnsweredQuestionsSchema(questionId: object, shortText: object): object {
  return {
    type: "array",
    maxItems: MAX_EXTRACTION_BUCKET_ITEMS,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["questionId", "questionText", "answerText", "evidenceText", "confidence"],
      properties: {
        questionId,
        questionText: shortText,
        answerText: shortText,
        evidenceText: shortText,
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
    },
  };
}

function buildDoubtfulFactsSchema(questionId: object, label: object, shortText: object): object {
  return {
    type: "array",
    maxItems: MAX_EXTRACTION_BUCKET_ITEMS,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["label", "value", "evidence", "reason", "relatedQuestionId"],
      properties: {
        label,
        value: { anyOf: [shortText, { type: "null" }] },
        evidence: shortText,
        reason: shortText,
        relatedQuestionId: { anyOf: [questionId, { type: "null" }] },
      },
    },
  };
}

function buildUnmappedFactsSchema(label: object, shortText: object): object {
  return {
    type: "array",
    maxItems: MAX_EXTRACTION_BUCKET_ITEMS,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["label", "value", "evidence"],
      properties: { label, value: shortText, evidence: shortText },
    },
  };
}
