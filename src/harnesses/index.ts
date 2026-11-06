import type { AnyHarness } from '../harness/contract.ts';
import { passageExegesis } from './passage-exegesis.ts';
import { peoplePlacesTimeline } from './people-places-timeline.ts';
import { thematicStudy } from './thematic-study.ts';
import { wordStudy } from './word-study.ts';

/** Every harness the CLI, the skill generator and (later) the MCP server expose. */
export const HARNESSES: readonly AnyHarness[] = [
  passageExegesis as AnyHarness,
  thematicStudy as AnyHarness,
  wordStudy as AnyHarness,
  peoplePlacesTimeline as AnyHarness,
];

export function getHarness(id: string): AnyHarness {
  const harness = HARNESSES.find((h) => h.id === id);
  if (!harness) throw new Error(`Unknown harness "${id}". Available: ${HARNESSES.map((h) => h.id).join(', ')}`);
  return harness;
}
