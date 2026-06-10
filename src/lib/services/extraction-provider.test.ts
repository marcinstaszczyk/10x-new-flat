import { describe, expect, it } from "vitest";

import { callOpenRouterExtraction } from "./extraction-provider";
import {
  belowLimitPastedContent,
  checksum,
  expectedCompletedExtraction,
  extractionInput,
  extractionQuestionIds,
  providerExtractionContent,
} from "@/test/fixtures/extraction";

const testModel = "test-openrouter-model";

describe("callOpenRouterExtraction", () => {
  it("parses provider output, filters non-answers, and completes unanswered questions", async () => {
    let requestBody: Record<string, unknown> | null = null;
    const fetcher: typeof fetch = (_url, init) => {
      requestBody = parseRequestBody(init?.body);

      return Promise.resolve(
        jsonResponse({
          choices: [{ message: { content: JSON.stringify(providerExtractionContent) } }],
        }),
      );
    };

    const result = await callOpenRouterExtraction(extractionInput, {
      apiKey: "test-key",
      fetcher,
      model: testModel,
      startedAt: Date.now(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const promptContent = getUserPromptContent(requestBody);
    const pastedContent = getPastedOfferContent(promptContent);

    expect(checksum(pastedContent)).toBe(checksum(belowLimitPastedContent));
    expect(pastedContent.length).toBe(belowLimitPastedContent.length);
    expect(promptContent).toContain(extractionQuestionIds.answered);
    expect(promptContent).toContain(extractionQuestionIds.doubtful);
    expect(promptContent).toContain(extractionQuestionIds.omitted);
    expect(promptContent).toContain(extractionQuestionIds.nonSubstantive);
    expect(result.result).toEqual(expectedCompletedExtraction);
  });

  it("returns invalid_output when provider content is not JSON", async () => {
    const result = await callOpenRouterExtraction(extractionInput, {
      apiKey: "test-key",
      fetcher: () => Promise.resolve(jsonResponse({ choices: [{ message: { content: "not-json" } }] })),
      model: testModel,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("returns invalid_output when provider JSON does not match the schema", async () => {
    const result = await callOpenRouterExtraction(extractionInput, {
      apiKey: "test-key",
      fetcher: () =>
        Promise.resolve(
          jsonResponse({ choices: [{ message: { content: JSON.stringify({ answeredQuestions: [] }) } }] }),
        ),
      model: testModel,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("returns provider failure for non-OK provider responses", async () => {
    const result = await callOpenRouterExtraction(extractionInput, {
      apiKey: "test-key",
      fetcher: () => Promise.resolve(jsonResponse({ error: { message: "rate limited" } }, { status: 429 })),
      model: testModel,
    });

    expect(result).toMatchObject({ ok: false, reason: "provider" });
  });
});

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}

function getUserPromptContent(requestBody: Record<string, unknown> | null): string {
  const messages = requestBody?.messages;
  if (!Array.isArray(messages)) {
    throw new Error("OpenRouter request did not include messages.");
  }

  const userMessage = messages.find(
    (message): message is { role: string; content: string } =>
      isRecord(message) && message.role === "user" && typeof message.content === "string",
  );

  if (!userMessage) {
    throw new Error("OpenRouter request did not include a user message.");
  }

  return userMessage.content;
}

function parseRequestBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== "string") {
    throw new Error("OpenRouter request body was not a string.");
  }

  const parsed = JSON.parse(body) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("OpenRouter request body was not an object.");
  }

  return parsed;
}

function getPastedOfferContent(promptContent: string): string {
  const marker = "Pasted offer content:\n";
  const markerIndex = promptContent.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("OpenRouter prompt did not include pasted offer content.");
  }

  return promptContent.slice(markerIndex + marker.length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
