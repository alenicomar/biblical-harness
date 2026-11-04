import { passageExegesis } from './passage-exegesis.js';
import { thematicStudy } from './thematic-study.js';
/** Every harness the CLI, the skill generator and (later) the MCP server expose. */
export const HARNESSES = [passageExegesis, thematicStudy];
export function getHarness(id) {
    const harness = HARNESSES.find((h) => h.id === id);
    if (!harness)
        throw new Error(`Unknown harness "${id}". Available: ${HARNESSES.map((h) => h.id).join(', ')}`);
    return harness;
}
