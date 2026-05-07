export type {
  FigmaNode,
  FigmaPaint,
  FigmaColor,
  FigmaBoundVariable,
  FigmaComponentPropertyDefinition,
  FigmaTypeStyle,
  FigmaEffect,
  FigmaStyle,
  FigmaVariable,
  FigmaVariableValue,
  FigmaFileMeta,
  FigmaPageSummary,
} from "./types/figma.js";

export type {
  ConformanceCheck,
  CheckContext,
  CheckResult,
  Violation,
  SummaryEntry,
  TokenClassification,
  TokenClassificationResult,
  AIClient,
  ConformanceCheckConfig,
  CheckStatus,
  ComponentSummary,
  AuditResult,
  AuditMeta,
  ComponentAuditResult,
} from "./types/checks.js";

export type { DSValidationConfig } from "./types/config.js";

export {
  computeCheckScore,
  computeComponentScore,
  computeTotalScore,
  determineStatus,
} from "./scoring/score.js";

export { buildSummary, renderSummary, SUMMARY_TEMPLATES } from "./templates/templates.js";

export { writeAuditResult, writeComponentResult } from "./output/writer.js";

export {
  AuditResultSchema,
  ComponentAuditResultSchema,
} from "./output/schemas.js";