import type { AnyHarness } from '../harness/contract.ts';
import { passageExegesis } from './passage-exegesis.ts';

/** Every harness the CLI, the skill generator and (later) the MCP server expose. */
export const HARNESSES: readonly AnyHarness[] = [passageExegesis as AnyHarness];

export function getHarness(id: string): AnyHarness {
  const harness = HARNESSES.find((h) => h.id === id);
  if (!harness) throw new Error(`Unknown harness "${id}". Available: ${HARNESSES.map((h) => h.id).join(', ')}`);
  return harness;
}
