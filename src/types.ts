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

export interface Database {
  public: {
    Tables: {
      flat_offers: {
        Row: {
          id: string;
          buyer_id: string;
          title: string;
          source_url: string | null;
          pasted_content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id?: string;
          title: string;
          source_url?: string | null;
          pasted_content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          title?: string;
          source_url?: string | null;
          pasted_content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flat_offers_buyer_id_fkey";
            columns: ["buyer_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      buyer_questions: {
        Row: {
          id: string;
          buyer_id: string;
          source_template_id: string | null;
          question_type: QuestionType;
          text: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          source_template_id?: string | null;
          question_type: QuestionType;
          text: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          source_template_id?: string | null;
          question_type?: QuestionType;
          text?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_questions_source_template_id_fkey";
            columns: ["source_template_id"];
            referencedRelation: "question_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      question_templates: {
        Row: {
          id: string;
          question_type: QuestionType;
          text: string;
          position: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_type: QuestionType;
          text: string;
          position: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          question_type?: QuestionType;
          text?: string;
          position?: number;
          is_active?: boolean;
          created_at?: string;
        };
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
