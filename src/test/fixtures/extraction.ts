import type { ExtractionQuestionInput, ExtractionRequestInput, ExtractionResult } from "@/types";
import { MAX_OFFER_CONTENT_CHARACTERS } from "@/lib/services/extraction-contract";

export const extractionQuestionIds = {
  answered: "question-parking",
  doubtful: "question-rent",
  omitted: "question-neighborhood",
  nonSubstantive: "question-utilities",
} as const;

export const extractionQuestions: ExtractionQuestionInput[] = [
  { id: extractionQuestionIds.answered, text: "Is parking included?" },
  { id: extractionQuestionIds.doubtful, text: "What is the monthly rent?" },
  { id: extractionQuestionIds.omitted, text: "How loud is the neighborhood?" },
  { id: extractionQuestionIds.nonSubstantive, text: "Are utilities included?" },
];

export const belowLimitPastedContent = [
  "LONG_OFFER_START",
  "Bright flat with a garage space. ".repeat(1500),
  "Utilities are described inconsistently in the listing.",
  "LONG_OFFER_END",
].join("\n");

export const tooLargePastedContent = "x".repeat(MAX_OFFER_CONTENT_CHARACTERS + 1);

export const extractionInput: ExtractionRequestInput = {
  offer: {
    id: "offer-test-1",
    title: "Long offer with mixed facts",
    pastedContent: belowLimitPastedContent,
  },
  questions: extractionQuestions,
};

export const providerExtractionContent = {
  answeredQuestions: [
    {
      questionId: extractionQuestionIds.answered,
      questionText: "Is parking included?",
      answerText: "Parking is included in the garage.",
      evidenceText: "Bright flat with a garage space.",
      confidence: "high",
    },
    {
      questionId: extractionQuestionIds.nonSubstantive,
      questionText: "Are utilities included?",
      answerText: "Not specified in the offer.",
      evidenceText: "The listing does not mention utilities clearly.",
      confidence: "low",
    },
  ],
  doubtfulFacts: [
    {
      label: "Monthly rent",
      value: "PLN 3,500 or PLN 3,800",
      evidence: "Two different rent values appear in separate paragraphs.",
      reason: "The pasted content is contradictory.",
      relatedQuestionId: extractionQuestionIds.doubtful,
    },
  ],
  unmappedFacts: [
    {
      label: "Floor",
      value: "4th floor",
      evidence: "The flat is on the 4th floor.",
    },
  ],
} as const;

export const expectedCompletedExtraction: ExtractionResult = {
  answeredQuestions: [
    {
      questionId: extractionQuestionIds.answered,
      questionText: "Is parking included?",
      answerText: "Parking is included in the garage.",
      evidenceText: "Bright flat with a garage space.",
      confidence: "high",
    },
  ],
  unansweredQuestions: [
    {
      questionId: extractionQuestionIds.omitted,
      questionText: "How loud is the neighborhood?",
    },
    {
      questionId: extractionQuestionIds.nonSubstantive,
      questionText: "Are utilities included?",
    },
  ],
  doubtfulFacts: [
    {
      label: "Monthly rent",
      value: "PLN 3,500 or PLN 3,800",
      evidence: "Two different rent values appear in separate paragraphs.",
      reason: "The pasted content is contradictory.",
      relatedQuestionId: extractionQuestionIds.doubtful,
    },
  ],
  unmappedFacts: [
    {
      label: "Floor",
      value: "4th floor",
      evidence: "The flat is on the 4th floor.",
    },
  ],
};

export function checksum(text: string): number {
  let total = 0;

  for (let i = 0; i < text.length; i += 1) {
    total += text.charCodeAt(i);
  }

  return total;
}
