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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
