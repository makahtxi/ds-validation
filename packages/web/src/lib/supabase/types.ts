export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_components: {
        Row: {
          audit_id: string;
          component_name: string;
          created_at: string;
          id: string;
          page_name: string;
          result: Json;
          score: number;
        };
        Insert: {
          audit_id: string;
          component_name: string;
          created_at?: string;
          id?: string;
          page_name: string;
          result?: Json;
          score: number;
        };
        Update: {
          audit_id?: string;
          component_name?: string;
          created_at?: string;
          id?: string;
          page_name?: string;
          result?: Json;
          score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "audit_components_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
        ];
      };
      audits: {
        Row: {
          config: Json | null;
          created_at: string;
          error_message: string | null;
          file_key: string;
          file_name: string;
          id: string;
          progress: Json | null;
          selected_pages: string[] | null;
          status: string;
          total_score: number | null;
          updated_at: string;
          user_id: string;
          variable_source: string | null;
        };
        Insert: {
          config?: Json | null;
          created_at?: string;
          error_message?: string | null;
          file_key: string;
          file_name: string;
          id?: string;
          progress?: Json | null;
          selected_pages?: string[] | null;
          status?: string;
          total_score?: number | null;
          updated_at?: string;
          user_id: string;
          variable_source?: string | null;
        };
        Update: {
          config?: Json | null;
          created_at?: string;
          error_message?: string | null;
          file_key?: string;
          file_name?: string;
          id?: string;
          progress?: Json | null;
          selected_pages?: string[] | null;
          status?: string;
          total_score?: number | null;
          updated_at?: string;
          user_id?: string;
          variable_source?: string | null;
        };
        Relationships: [];
      };
      classifications: {
        Row: {
          decisions: Json;
          file_key: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          decisions?: Json;
          file_key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          decisions?: Json;
          file_key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      figma_connections: {
        Row: {
          created_at: string;
          encrypted_access_token: string;
          encrypted_refresh_token: string | null;
          expires_at: string | null;
          figma_user_handle: string | null;
          figma_user_id: string | null;
          figma_user_img_url: string | null;
          granted_scopes: string[] | null;
          id: string;
          kind: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          encrypted_access_token: string;
          encrypted_refresh_token?: string | null;
          expires_at?: string | null;
          figma_user_handle?: string | null;
          figma_user_id?: string | null;
          figma_user_img_url?: string | null;
          granted_scopes?: string[] | null;
          id?: string;
          kind: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          encrypted_access_token?: string;
          encrypted_refresh_token?: string | null;
          expires_at?: string | null;
          figma_user_handle?: string | null;
          figma_user_id?: string | null;
          figma_user_img_url?: string | null;
          granted_scopes?: string[] | null;
          id?: string;
          kind?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      variable_uploads: {
        Row: {
          consumed: boolean;
          created_at: string;
          expires_at: string;
          file_key: string;
          pairing_code: string;
          payload: Json | null;
          user_id: string;
        };
        Insert: {
          consumed?: boolean;
          created_at?: string;
          expires_at: string;
          file_key: string;
          pairing_code: string;
          payload?: Json | null;
          user_id: string;
        };
        Update: {
          consumed?: boolean;
          created_at?: string;
          expires_at?: string;
          file_key?: string;
          pairing_code?: string;
          payload?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

export type AuditStatus = "draft" | "queued" | "running" | "done" | "error";
export type VariableSource = "rest-api" | "plugin" | "skip";

export interface AuditProgress {
  stage: string;
  current: number;
  total: number;
  message?: string;
}