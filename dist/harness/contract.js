import { buildPrompt } from './prompt.js';
/** Identity helper that keeps input, output and bundle types inferred. */
export function defineHarness(harness) {
    return harness;
}
export class HarnessInputError extends Error {
    constructor(harnessId, issues) {
        super(`Invalid input for harness "${harnessId}": ${issues}`);
        this.name = 'HarnessInputError';
    }
}
export class HarnessOutputError extends Error {
    raw;
    constructor(harnessId, reason, raw) {
        super(`Harness "${harnessId}" got an unusable model reply: ${reason}`);
        this.name = 'HarnessOutputError';
        this.raw = raw;
    }
}
function describeIssues(error) {
    return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}
/** Validates raw input against the harness schema, applying its defaults. */
export function parseInput(harness, raw) {
    const parsed = harness.input.safeParse(raw);
    if (!parsed.success)
        throw new HarnessInputError(harness.id, describeIssues(parsed.error));
    return parsed.data;
}
/** Validates input and gathers the evidence bundle. Shared by both faces. */
export async function gatherEvidence(harness, raw, context) {
    const input = parseInput(harness, raw);
    return { input, bundle: await harness.gather(input, context) };
}
export async function runHarness(harness, raw, context) {
    const { input, bundle } = await gatherEvidence(harness, raw, context);
    const prompt = buildPrompt(harness, { input, bundle, profile: context.profile, language: context.language });
    const reply = await context.provider.complete({ ...prompt, maxTokens: context.maxTokens });
    let json;
    try {
        json = JSON.parse(extractJson(reply));
    }
    catch {
        throw new HarnessOutputError(harness.id, 'the reply is not valid JSON', reply);
    }
    const parsed = harness.output.safeParse(json);
    if (!parsed.success)
        throw new HarnessOutputError(harness.id, describeIssues(parsed.error), reply);
    return { report: parsed.data, bundle, prompt };
}
/** Strips a Markdown code fence or surrounding prose from a JSON reply. */
function extractJson(reply) {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(reply);
    if (fenced?.[1])
        return fenced[1].trim();
    const start = reply.indexOf('{');
    const end = reply.lastIndexOf('}');
    return start >= 0 && end > start ? reply.slice(start, end + 1) : reply.trim();
}
