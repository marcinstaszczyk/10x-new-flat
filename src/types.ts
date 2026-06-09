export type QuestionType = "category" | "open_question";

export interface BuyerQuestion {
  id: string;
  sourceTemplateId: string | null;
  type: QuestionType;
  text: string;
  position: number;
}

export interface SavedOffer {
  id: string;
  title: string;
  sourceUrl: string | null;
  pastedContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionOfferInput {
  id: string;
  title: string;
  pastedContent: string;
}

export interface ExtractionQuestionInput {
  id: string;
  text: string;
}

export interface ExtractionRequestInput {
  offer: ExtractionOfferInput;
  questions: ExtractionQuestionInput[];
}

export interface AnsweredExtractionQuestion {
  questionId: string;
  questionText: string;
  answerText: string;
  evidenceText: string;
  confidence: "high" | "medium" | "low";
}

export interface UnansweredExtractionQuestion {
  questionId: string;
  questionText: string;
}

export interface DoubtfulExtractionFact {
  label: string;
  value: string | null;
  evidence: string;
  reason: string;
  relatedQuestionId?: string | null;
}

export interface UnmappedExtractionFact {
  label: string;
  value: string;
  evidence: string;
}

export interface ExtractionResult {
  answeredQuestions: AnsweredExtractionQuestion[];
  unansweredQuestions: UnansweredExtractionQuestion[];
  doubtfulFacts: DoubtfulExtractionFact[];
  unmappedFacts: UnmappedExtractionFact[];
}

export type OfferExtractionResultStatus = "completed";

export interface OfferExtractionResult {
  id: string;
  offerId: string;
  status: OfferExtractionResultStatus;
  result: ExtractionResult;
  model: string;
  latencyMs: number;
  createdAt: string;
  updatedAt: string;
}

type DbInsert<Row, OptionalKeys extends keyof Row> = Omit<Row, OptionalKeys> & Partial<Pick<Row, OptionalKeys>>;
type DbUpdate<Row> = Partial<Row>;

interface DbRelationship<
  ForeignKeyName extends string,
  Columns extends string[],
  ReferencedRelation extends string,
  ReferencedColumns extends string[],
> {
  foreignKeyName: ForeignKeyName;
  columns: Columns;
  referencedRelation: ReferencedRelation;
  referencedColumns: ReferencedColumns;
}

interface FlatOfferRecord {
  id: string;
  buyer_id: string;
  title: string;
  source_url: string | null;
  pasted_content: string;
  created_at: string;
  updated_at: string;
}

interface OfferExtractionResultRecord {
  id: string;
  offer_id: string;
  buyer_id: string;
  status: OfferExtractionResultStatus;
  result: ExtractionResult;
  model: string;
  latency_ms: number;
  created_at: string;
  updated_at: string;
}

interface BuyerQuestionRecord {
  id: string;
  buyer_id: string;
  source_template_id: string | null;
  question_type: QuestionType;
  text: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface QuestionTemplateRecord {
  id: string;
  question_type: QuestionType;
  text: string;
  position: number;
  is_active: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      flat_offers: {
        Row: FlatOfferRecord;
        Insert: DbInsert<FlatOfferRecord, "id" | "buyer_id" | "source_url" | "created_at" | "updated_at">;
        Update: DbUpdate<FlatOfferRecord>;
        Relationships: [DbRelationship<"flat_offers_buyer_id_fkey", ["buyer_id"], "users", ["id"]>];
      };
      offer_extraction_results: {
        Row: OfferExtractionResultRecord;
        Insert: DbInsert<OfferExtractionResultRecord, "id" | "buyer_id" | "status" | "created_at" | "updated_at">;
        Update: DbUpdate<OfferExtractionResultRecord>;
        Relationships: [
          DbRelationship<"offer_extraction_results_buyer_id_fkey", ["buyer_id"], "users", ["id"]>,
          DbRelationship<"offer_extraction_results_offer_id_fkey", ["offer_id"], "flat_offers", ["id"]>,
        ];
      };
      buyer_questions: {
        Row: BuyerQuestionRecord;
        Insert: DbInsert<BuyerQuestionRecord, "id" | "source_template_id" | "created_at" | "updated_at">;
        Update: DbUpdate<BuyerQuestionRecord>;
        Relationships: [
          DbRelationship<
            "buyer_questions_source_template_id_fkey",
            ["source_template_id"],
            "question_templates",
            ["id"]
          >,
        ];
      };
      question_templates: {
        Row: QuestionTemplateRecord;
        Insert: DbInsert<QuestionTemplateRecord, "id" | "is_active" | "created_at">;
        Update: DbUpdate<QuestionTemplateRecord>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      ensure_buyer_question_base: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      reset_buyer_question_base: {
        Args: Record<never, never>;
        Returns: undefined;
      };
    };
    Enums: {
      question_type: QuestionType;
    };
    CompositeTypes: Record<never, never>;
  };
}
