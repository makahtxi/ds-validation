import { randomInt } from "crypto";
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from "./config";

/** Generate a short, human-typable single-use pairing code for the plugin handoff. */
export function generatePairingCode(): string {
  let code = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalize user/plugin input to match stored codes (uppercase, no spaces). */
export function normalizePairingCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
