import type { ExtractionQuestionInput, ExtractionResult } from "@/types";
import type { ExtractOfferPreparation } from "./offer-preparation";

export function createE2eOpenRouterMockExtractor(): ExtractOfferPreparation {
  return (input) => {
    const result = buildMockResult(input.questions);

    return Promise.resolve({
      ok: true,
      result,
      metadata: {
        model: "e2e-openrouter-mock",
        latencyMs: 1,
      },
    });
  };
}

function buildMockResult(questions: ExtractionQuestionInput[]): ExtractionResult {
  const answeredQuestion = questions[0] ?? fallbackQuestion("e2e-question-answered", "E2E answered question");
  const unansweredQuestion = questions[1] ?? fallbackQuestion("e2e-question-unanswered", "E2E unanswered question");
  const doubtfulQuestion = questions[2] ?? fallbackQuestion("e2e-question-doubtful", "E2E doubtful question");

  return {
    answeredQuestions: [
      {
        questionId: answeredQuestion.id,
        questionText: answeredQuestion.text,
        answerText: "E2E answer: parking is included in the garage.",
        evidenceText: "E2E_LONG_OFFER_FACT: private garage space is included.",
        confidence: "high",
      },
    ],
    unansweredQuestions: [
      {
        questionId: unansweredQuestion.id,
        questionText: unansweredQuestion.text,
      },
    ],
    doubtfulFacts: [
      {
        label: "E2E doubtful monthly rent",
        value: "PLN 3,500 or PLN 3,800",
        evidence: "The offer contains two different monthly rent values.",
        reason: "The values conflict and need buyer verification.",
        relatedQuestionId: doubtfulQuestion.id,
      },
    ],
    unmappedFacts: [
      {
        label: "E2E unmapped floor",
        value: "4th floor",
        evidence: "The offer says the flat is on the 4th floor.",
      },
    ],
  };
}

function fallbackQuestion(id: string, text: string): ExtractionQuestionInput {
  return { id, text };
}
