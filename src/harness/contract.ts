import type { z } from 'zod';
import type { BibleApiClient } from '../core/client.ts';
import type { LlmProvider } from './llm.ts';
import type { DoctrinalProfile } from './profiles.ts';
import { buildPrompt, type Prompt } from './prompt.ts';

/**
 * One analysis, defined once and exposed two ways:
 * - skill face: `renderSkill` turns it into a SKILL.md an agent follows, gathering
 *   evidence through the CLI (later, the MCP server);
 * - pipeline face: `runHarness` gathers the evidence, prompts a model and
 *   validates the structured report against `output`.
 */
export interface Harness<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType, B = unknown> {
  /** Kebab-case id, also the skill name and CLI argument. */
  id: string;
  title: string;
  /** "Use when..." sentence: the skill description agents match on. */
  summary: string;
  input: I;
  output: O;
  /** Ordered method steps, imperative. */
  method: readonly string[];
  /** Rules specific to this harness, added after the shared guardrails. */
  guardrails?: readonly string[];
  /** Collects the evidence bundle from the API. Deterministic: no model calls. */
  gather(input: z.output<I>, context: HarnessContext): Promise<B>;
}

export interface HarnessContext {
  client: BibleApiClient;
  profile: DoctrinalProfile;
  /** Output language code, e.g. "es". */
  language: string;
}

export type AnyHarness = Harness<z.ZodType, z.ZodType, unknown>;

/** Identity helper that keeps input, output and bundle types inferred. */
export function defineHarness<I extends z.ZodType, O extends z.ZodType, B>(harness: Harness<I, O, B>): Harness<I, O, B> {
  return harness;
}

export class HarnessInputError extends Error {
  constructor(harnessId: string, issues: string) {
    super(`Invalid input for harness "${harnessId}": ${issues}`);
    this.name = 'HarnessInputError';
  }
}

export class HarnessOutputError extends Error {
  readonly raw: string;

  constructor(harnessId: string, reason: string, raw: string) {
    super(`Harness "${harnessId}" got an unusable model reply: ${reason}`);
    this.name = 'HarnessOutputError';
    this.raw = raw;
  }
}

function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}

/** Validates raw input against the harness schema, applying its defaults. */
export function parseInput<I extends z.ZodType>(harness: Harness<I, z.ZodType, unknown>, raw: unknown): z.output<I> {
  const parsed = harness.input.safeParse(raw);
  if (!parsed.success) throw new HarnessInputError(harness.id, describeIssues(parsed.error));
  return parsed.data;
}

/** Validates input and gathers the evidence bundle. Shared by both faces. */
export async function gatherEvidence<I extends z.ZodType, B>(
  harness: Harness<I, z.ZodType, B>,
  raw: unknown,
  context: HarnessContext,
): Promise<{ input: z.output<I>; bundle: B }> {
  const input = parseInput(harness, raw);
  return { input, bundle: await harness.gather(input, context) };
}

export interface HarnessRun<O, B> {
  report: O;
  bundle: B;
  prompt: Prompt;
}

export async function runHarness<I extends z.ZodType, O extends z.ZodType, B>(
  harness: Harness<I, O, B>,
  raw: unknown,
  context: HarnessContext & { provider: LlmProvider; maxTokens?: number },
): Promise<HarnessRun<z.output<O>, B>> {
  const { input, bundle } = await gatherEvidence(harness, raw, context);
  const prompt = buildPrompt(harness, { input, bundle, profile: context.profile, language: context.language });
  const reply = await context.provider.complete({ ...prompt, maxTokens: context.maxTokens });

  let json: unknown;
  try {
    json = JSON.parse(extractJson(reply));
  } catch {
    throw new HarnessOutputError(harness.id, 'the reply is not valid JSON', reply);
  }
  const parsed = harness.output.safeParse(json);
  if (!parsed.success) throw new HarnessOutputError(harness.id, describeIssues(parsed.error), reply);
  return { report: parsed.data, bundle, prompt };
}

/** Strips a Markdown code fence or surrounding prose from a JSON reply. */
function extractJson(reply: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(reply);
  if (fenced?.[1]) return fenced[1].trim();
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  return start >= 0 && end > start ? reply.slice(start, end + 1) : reply.trim();
}
