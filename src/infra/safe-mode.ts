import process from "node:process";
import { parseBooleanValue } from "../utils/boolean.js";

/**
 * Checks if Safe Mode is enabled via OPENCLAW_SAFE_MODE environment variable.
 * Safe Mode restricts process execution, plugin loading, and shell profile modifications.
 */
export function isSafeMode(): boolean {
  return parseBooleanValue(process.env.OPENCLAW_SAFE_MODE) === true;
}
