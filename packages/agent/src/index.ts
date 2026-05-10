import "./register-checks.js";

export { registry } from "./checks/registry.js";
export { hardcodedColorsCheck } from "./checks/hardcoded-colors.js";
export { hardcodedSpacingCheck } from "./checks/hardcoded-spacing.js";
export { hardcodedTextStylesCheck } from "./checks/hardcoded-text-styles.js";
export { noPrimitiveTokensCheck } from "./checks/no-primitive-tokens.js";
export { stateVariablesCheck } from "./checks/state-variables.js";
export { auditComponent, auditFile } from "./orchestrator.js";
export type { AuditFileResult, AuditFileOptions } from "./orchestrator.js";
export { classifyComponent, collectAmbiguousComponents } from "./classifier.js";
export { loadClassifications, saveClassifications } from "./classification-store.js";