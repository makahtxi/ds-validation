import { registry } from "./checks/registry.js";
import { hardcodedColorsCheck } from "./checks/hardcoded-colors.js";
import { hardcodedSpacingCheck } from "./checks/hardcoded-spacing.js";
import { hardcodedTextStylesCheck } from "./checks/hardcoded-text-styles.js";
import { noPrimitiveTokensCheck } from "./checks/no-primitive-tokens.js";
import { stateVariablesCheck } from "./checks/state-variables.js";

registry.register(hardcodedColorsCheck);
registry.register(hardcodedSpacingCheck);
registry.register(hardcodedTextStylesCheck);
registry.register(noPrimitiveTokensCheck);
registry.register(stateVariablesCheck);