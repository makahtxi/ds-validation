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
  ConformanceCheckConfig,
  CheckStatus,
  ComponentSummary,
  AuditResult,
  AuditMeta,
  ComponentAuditResult,
} from "./types/checks.js";

export type {
  ComponentClassification,
  CheckComponentRules,
  ClassificationDecision,
  ClassificationStore,
  ClassificationOverride,
} from "./types/classification.js";

export type { DSValidationConfig } from "./types/config.js";

export {
  computeCheckScore,
  computeComponentScore,
  computeTotalScore,
  determineStatus,
} from "./scoring/score.js";

export {
  linearize,
  relativeLuminance,
  contrastRatio,
  blendColor,
  colorToHex,
  getSolidFillColor,
  isGrayScale,
} from "./color/contrast.js";

export { buildSummary, renderSummary, SUMMARY_TEMPLATES } from "./templates/templates.js";

export { writeAuditResult, loadAuditResult, writeComponentResult, sanitizeComponentName } from "./output/writer.js";

export { mergeAuditResults, buildComponentSummary } from "./output/merge.js";

export {
  AuditResultSchema,
  ComponentAuditResultSchema,
} from "./output/schemas.js";