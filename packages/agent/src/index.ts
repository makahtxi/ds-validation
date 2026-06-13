import "./register-checks.js";

export { registry } from "./checks/registry.js";
export { hardcodedColorsCheck } from "./checks/hardcoded-colors.js";
export { hardcodedSpacingCheck } from "./checks/hardcoded-spacing.js";
export { hardcodedTextStylesCheck } from "./checks/hardcoded-text-styles.js";
export { noPrimitiveTokensCheck } from "./checks/no-primitive-tokens.js";
export { stateVariablesCheck } from "./checks/state-variables.js";
export { auditComponent, auditFile, assembleAuditResult } from "./orchestrator.js";
export type { AuditFileResult, AuditFileOptions } from "./orchestrator.js";
export { classifyComponent, collectAmbiguousComponents, type ClassificationResults } from "./classifier.js";
export { FileClassificationStore, loadClassifications, saveClassifications } from "./classification-store.js";
export {
  resolveFile,
  runAudit,
  prepareRunnerState,
  runAuditChunk,
  isRunComplete,
  finalizeRun,
} from "./runner.js";
export type {
  AuditRunConfig,
  RunAuditOptions,
  ResolveFileResult,
  RunnerState,
  ProgressCallback,
} from "./runner.js";