export interface Database {
  public: {
    Tables: {
      figma_connections: {
        Row: {
          id: string;
          user_id: string;
          kind: "oauth" | "pat";
          encrypted_access_token: string;
          encrypted_refresh_token: string | null;
          figma_user_id: string | null;
          figma_user_handle: string | null;
          figma_user_img_url: string | null;
          granted_scopes: string[] | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: "oauth" | "pat";
          encrypted_access_token: string;
          encrypted_refresh_token?: string | null;
          figma_user_id?: string | null;
          figma_user_handle?: string | null;
          figma_user_img_url?: string | null;
          granted_scopes?: string[] | null;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: "oauth" | "pat";
          encrypted_access_token?: string;
          encrypted_refresh_token?: string | null;
          figma_user_id?: string | null;
          figma_user_handle?: string | null;
          figma_user_img_url?: string | null;
          granted_scopes?: string[] | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audits: {
        Row: {
          id: string;
          user_id: string;
          file_key: string;
          file_name: string | null;
          status: "draft" | "queued" | "running" | "done" | "error";
          progress: AuditProgress;
          selected_pages: string[] | null;
          variable_source: "rest" | "plugin" | "skip" | null;
          total_score: number | null;
          config: Record<string, unknown>;
          runner_state: Record<string, unknown> | null;
          error_message: string | null;
          started_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_key: string;
          file_name?: string | null;
          status?: "draft" | "queued" | "running" | "done" | "error";
          progress?: AuditProgress;
          selected_pages?: string[] | null;
          variable_source?: "rest" | "plugin" | "skip" | null;
          total_score?: number | null;
          config?: Record<string, unknown>;
          runner_state?: Record<string, unknown> | null;
          error_message?: string | null;
          started_at?: string | null;
        };
        Update: {
          status?: "draft" | "queued" | "running" | "done" | "error";
          progress?: AuditProgress;
          selected_pages?: string[] | null;
          variable_source?: "rest" | "plugin" | "skip" | null;
          total_score?: number | null;
          config?: Record<string, unknown>;
          runner_state?: Record<string, unknown> | null;
          error_message?: string | null;
          started_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_components: {
        Row: {
          id: string;
          audit_id: string;
          user_id: string;
          component_name: string;
          page_name: string | null;
          score: number | null;
          result: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          audit_id: string;
          user_id: string;
          component_name: string;
          page_name?: string | null;
          score?: number | null;
          result: Record<string, unknown>;
        };
        Update: {
          score?: number | null;
          page_name?: string | null;
          result?: Record<string, unknown>;
        };
        Relationships: [];
      };
      variable_uploads: {
        Row: {
          id: string;
          user_id: string;
          audit_id: string | null;
          file_key: string;
          pairing_code: string;
          payload: Record<string, unknown> | null;
          consumed: boolean;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          audit_id?: string | null;
          file_key: string;
          pairing_code: string;
          payload?: Record<string, unknown> | null;
          consumed?: boolean;
          expires_at: string;
        };
        Update: {
          payload?: Record<string, unknown> | null;
          consumed?: boolean;
        };
        Relationships: [];
      };
      classifications: {
        Row: {
          id: string;
          user_id: string;
          file_key: string;
          decisions: Record<string, string>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_key: string;
          decisions?: Record<string, string>;
        };
        Update: {
          decisions?: Record<string, string>;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export interface AuditProgress {
  stage?: string;
  current?: number;
  total?: number;
}
