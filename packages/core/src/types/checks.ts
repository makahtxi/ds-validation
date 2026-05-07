import type {
  FigmaNode,
  FigmaStyle,
  FigmaVariable,
  FigmaBoundVariable,
} from "./figma.js";

export interface ConformanceCheck {
  id: string;
  name: string;
  weight: number;
  run(context: CheckContext): Promise<CheckResult>;
}

export interface CheckContext {
  componentNode: FigmaNode;
  styles: Record<string, FigmaStyle>;
  variables: Record<string, FigmaVariable>;
  ai: AIClient;
}

export interface CheckResult {
  checkId: string;
  score: number;
  status: "pass" | "fail" | "partial";
  violations: Violation[];
  summary: SummaryEntry;
}

export interface Violation {
  nodePath: string;
  property: string;
  rawValue: string;
  expected: string;
  suggestedReplacement?: string;
}

export interface SummaryEntry {
  template: string;
  params: Record<string, string | number>;
}

export type TokenClassification = "semantic" | "primitive" | "wrong_category";

export interface TokenClassificationResult {
  classification: TokenClassification;
  suggestedReplacement: string | null;
  category?: string;
}

export interface AIClient {
  classifyToken(
    tokenName: string,
    semanticTokenList: string[],
  ): Promise<TokenClassificationResult>;

  classifyTokens(
    tokens: string[],
    semanticTokenList: string[],
  ): Promise<Record<string, TokenClassificationResult>>;

  generatePrimitiveTokenSummary(violations: Violation[]): Promise<SummaryEntry>;
}

export interface ConformanceCheckConfig {
  id: string;
  name: string;
  weight: number;
}

export type CheckStatus = "pass" | "fail" | "partial";

export interface ComponentSummary {
  name: string;
  score: number;
  jsonPath: string;
  passedChecks: number;
  totalChecks: number;
}

export interface AuditResult {
  meta: AuditMeta;
  totalScore: number;
  summary: SummaryEntry;
  components: ComponentSummary[];
}

export interface AuditMeta {
  figmaFileKey: string;
  figmaFileName: string;
  auditedAt: string;
  pagesAudited: string[];
  conformanceChecks: ConformanceCheckConfig[];
}

export interface ComponentAuditResult {
  componentName: string;
  score: number;
  checkResults: Record<string, CheckResult>;
}