export interface DSValidationConfig {
  figma?: {
    fileKey?: string;
    accessToken?: string;
    variableSource?: "rest-api" | "mcp" | "skip";
  };
  checks?: Record<string, { weight?: number; enabled?: boolean; rules?: { interactive?: string[]; nonInteractive?: string[] } }>;
  ai?: {
    model?: string;
    apiKey?: string;
  };
  mcp?: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
  output?: {
    dir?: string;
  };
}