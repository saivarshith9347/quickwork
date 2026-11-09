export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      applications: {
        Row: {
          applied_at: string;
          cancelled_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          employer_note: string | null;
          id: string;
          job_category_id: string;
          job_id: string;
          position_id: string;
          status: string;
          updated_at: string;
          worker_id: string;
          worker_note: string | null;
        };
        Insert: {
          applied_at?: string;
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          employer_note?: string | null;
          id?: string;
          job_category_id: string;
          job_id: string;
          position_id: string;
          status?: string;
          updated_at?: string;
          worker_id: string;
          worker_note?: string | null;
        };
        Update: {
          applied_at?: string;
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          employer_note?: string | null;
          id?: string;
          job_category_id?: string;
          job_id?: string;
          position_id?: string;
          status?: string;
          updated_at?: string;
          worker_id?: string;
          worker_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "applications_job_category_id_fkey";
            columns: ["job_category_id"];
            isOneToOne: false;
            referencedRelation: "job_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "job_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "job_positions_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      job_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          job_id: string;
          name: string;
          required_workers: number;
          requirements: Json | null;
          sort_order: number;
          updated_at: string;
          wage: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          job_id: string;
          name: string;
          required_workers: number;
          requirements?: Json | null;
          sort_order?: number;
          updated_at?: string;
          wage: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          job_id?: string;
          name?: string;
          required_workers?: number;
          requirements?: Json | null;
          sort_order?: number;
          updated_at?: string;
          wage?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_categories_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_positions: {
        Row: {
          application_id: string | null;
          created_at: string;
          id: string;
          job_category_id: string;
          job_id: string;
          lock_expires_at: string | null;
          locked_at: string | null;
          position_number: number;
          status: string;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          job_category_id: string;
          job_id: string;
          lock_expires_at?: string | null;
          locked_at?: string | null;
          position_number: number;
          status?: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          job_category_id?: string;
          job_id?: string;
          lock_expires_at?: string | null;
          locked_at?: string | null;
          position_number?: number;
          status?: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_positions_application_id_fk";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_positions_job_category_id_fkey";
            columns: ["job_category_id"];
            isOneToOne: false;
            referencedRelation: "job_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_positions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_positions_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_positions_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      job_private: {
        Row: {
          created_at: string;
          job_id: string;
          reporting_contact: Json | null;
        };
        Insert: {
          created_at?: string;
          job_id: string;
          reporting_contact?: Json | null;
        };
        Update: {
          created_at?: string;
          job_id?: string;
          reporting_contact?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_private_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          area: string;
          category: string;
          city: string;
          created_at: string;
          description: string;
          employer_id: string;
          end_time: string;
          facilities: string[] | null;
          full_address: string;
          id: string;
          instructions: Json | null;
          is_rapid_job: boolean;
          job_date: string;
          job_title: string;
          job_type: string;
          landmark: string | null;
          rapid_job_expires_at: string | null;
          requirements: Json | null;
          start_time: string;
          status: string;
          updated_at: string;
          venue_name: string;
        };
        Insert: {
          area: string;
          category: string;
          city: string;
          created_at?: string;
          description: string;
          employer_id: string;
          end_time: string;
          facilities?: string[] | null;
          full_address: string;
          id?: string;
          instructions?: Json | null;
          is_rapid_job?: boolean;
          job_date: string;
          job_title: string;
          job_type?: string;
          landmark?: string | null;
          rapid_job_expires_at?: string | null;
          requirements?: Json | null;
          start_time: string;
          status?: string;
          updated_at?: string;
          venue_name: string;
        };
        Update: {
          area?: string;
          category?: string;
          city?: string;
          created_at?: string;
          description?: string;
          employer_id?: string;
          end_time?: string;
          facilities?: string[] | null;
          full_address?: string;
          id?: string;
          instructions?: Json | null;
          is_rapid_job?: boolean;
          job_date?: string;
          job_title?: string;
          job_type?: string;
          landmark?: string | null;
          rapid_job_expires_at?: string | null;
          requirements?: Json | null;
          start_time?: string;
          status?: string;
          updated_at?: string;
          venue_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_employer_id_fkey";
            columns: ["employer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_employer_id_fkey";
            columns: ["employer_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          id: string;
          location: string | null;
          name: string | null;
          phone: string | null;
          profile_complete: boolean;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          id: string;
          location?: string | null;
          name?: string | null;
          phone?: string | null;
          profile_complete?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          location?: string | null;
          name?: string | null;
          phone?: string | null;
          profile_complete?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      job_positions_public: {
        Row: {
          created_at: string | null;
          id: string | null;
          job_category_id: string | null;
          job_id: string | null;
          lock_expires_at: string | null;
          my_application_id: string | null;
          my_worker_id: string | null;
          position_number: number | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string | null;
          job_category_id?: string | null;
          job_id?: string | null;
          lock_expires_at?: never;
          my_application_id?: never;
          my_worker_id?: never;
          position_number?: number | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string | null;
          job_category_id?: string | null;
          job_id?: string | null;
          lock_expires_at?: never;
          my_application_id?: never;
          my_worker_id?: never;
          position_number?: number | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_positions_job_category_id_fkey";
            columns: ["job_category_id"];
            isOneToOne: false;
            referencedRelation: "job_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_positions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      public_profiles: {
        Row: {
          avatar_url: string | null;
          id: string | null;
          location: string | null;
          name: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          id?: string | null;
          location?: string | null;
          name?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          id?: string | null;
          location?: string | null;
          name?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      cancel_application: { Args: { p_application_id: string }; Returns: Json };
      cleanup_expired_locks: { Args: never; Returns: number };
      confirm_booking: {
        Args: { p_position_id: string; p_worker_note?: string };
        Returns: Json;
      };
      employer_adjust_category_headcount: {
        Args: { p_category_id: string; p_new_count: number };
        Returns: Json;
      };
      fn_adjust_category_positions: {
        Args: { p_category_id: string; p_new_count: number };
        Returns: Json;
      };
      fn_fill_positions_for_category: {
        Args: { p_category_id: string };
        Returns: number;
      };
      fn_get_category_position_stats: {
        Args: { p_category_id: string };
        Returns: Json;
      };
      fn_get_job_position_stats: { Args: { p_job_id: string }; Returns: Json };
      release_position: { Args: { p_position_id: string }; Returns: Json };
      reserve_position: { Args: { p_position_id: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
