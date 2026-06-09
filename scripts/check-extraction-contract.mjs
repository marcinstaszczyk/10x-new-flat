/* eslint-disable no-console */
/* global console, fetch, process */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_EXTRACTION_MODEL, validateExtractionInput } from "../src/lib/services/extraction-contract.ts";
import { callOpenRouterExtraction } from "../src/lib/services/extraction-provider.ts";

const FIXTURE_DIR = join("scripts", "fixtures", "extraction-contract");

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_EXTRACTION_MODEL;

  if (!apiKey) {
    fail("configuration", "OPENROUTER_API_KEY is required for the live extraction contract check.");
  }

  const input = await readFixtureInput();
  const expected = await readJsonFixture("expected.json");
  const inputFailure = validateExtractionInput(input);

  if (inputFailure) {
    fail("input_too_large", inputFailure);
  }

  const startedAt = Date.now();
  const extraction = await callOpenRouterExtraction(input, { apiKey, fetcher: fetch, model, startedAt });

  if (!extraction.ok) {
    fail(extraction.reason, extraction.diagnostic);
  }

  const { latencyMs } = extraction.metadata;
  const { result } = extraction;
  validateInvariants(result, expected, latencyMs);

  console.log(`Extraction contract check passed.`);
  console.log(`Model: ${model}`);
  console.log(`Latency: ${latencyMs}ms`);
  console.log(
    `Buckets: answered=${result.answeredQuestions.length}, unanswered=${result.unansweredQuestions.length}, doubtful=${result.doubtfulFacts.length}, unmapped=${result.unmappedFacts.length}`,
  );
}

async function readFixtureInput() {
  const offerContent = await readFile(join(FIXTURE_DIR, "offer.txt"), "utf8");
  const questions = await readJsonFixture("questions.json");

  return {
    offer: {
      id: "fixture-offer",
      title: "Two-room flat near Metro Slodowiec",
      pastedContent: offerContent,
    },
    questions,
  };
}

async function readJsonFixture(filename) {
  const content = await readFile(join(FIXTURE_DIR, filename), "utf8");
  return JSON.parse(content);
}

function validateInvariants(result, expected, latencyMs) {
  const failures = [];
  const counts = expected.minimumBucketCounts;

  if (latencyMs > expected.maxLatencyMs) {
    failures.push(`latency exceeded ${expected.maxLatencyMs}ms`);
  }

  for (const [bucket, minimum] of Object.entries(counts)) {
    if (result[bucket].length < minimum) {
      failures.push(`${bucket} expected at least ${minimum}, got ${result[bucket].length}`);
    }
  }

  requireQuestionIds(
    failures,
    "answeredQuestions",
    result.answeredQuestions.map((item) => item.questionId),
    expected.requiredAnsweredQuestionIds,
  );
  requireQuestionIds(
    failures,
    "unansweredQuestions",
    result.unansweredQuestions.map((item) => item.questionId),
    expected.requiredUnansweredQuestionIds,
  );
  requireQuestionIds(
    failures,
    "doubtfulFacts",
    result.doubtfulFacts.map((item) => item.relatedQuestionId).filter(Boolean),
    expected.requiredDoubtfulQuestionIds,
  );

  if (failures.length > 0) {
    fail("invariant", failures.join("; "));
  }
}

function requireQuestionIds(failures, bucket, actualIds, requiredIds = []) {
  for (const requiredId of requiredIds) {
    if (!actualIds.includes(requiredId)) {
      failures.push(`${bucket} missing ${requiredId}`);
    }
  }
}

function fail(reason, diagnostic) {
  console.error(`Extraction contract check failed: ${reason}. ${diagnostic}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`Extraction contract check failed: unexpected. ${error.message}`);
  process.exit(1);
});
