import { z } from 'zod';
import type { Harness } from './contract.ts';
import { languageRule, SHARED_GUARDRAILS } from './guardrails.ts';
import { COMMON_CONVICTIONS, type DoctrinalProfile } from './profiles.ts';

export interface Prompt {
  system: string;
  user: string;
}

export interface PromptParts {
  input: unknown;
  bundle: unknown;
  profile: DoctrinalProfile;
  language: string;
}

const bullets = (lines: readonly string[]) => lines.map((line) => `- ${line}`).join('\n');
const numbered = (lines: readonly string[]) => lines.map((line, index) => `${index + 1}. ${line}`).join('\n');

export function jsonSchemaOf(schema: z.ZodType): string {
  return JSON.stringify(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' }), null, 2);
}

/** Pipeline face: the system prompt carries the rules, the user prompt carries the task and evidence. */
export function buildPrompt(harness: Harness<z.ZodType, z.ZodType, unknown>, parts: PromptParts): Prompt {
  const system = [
    'You are a careful Bible-study assistant serving Protestant/Evangelical study. You work only from the evidence you are given.',
    `## Shared convictions\n${bullets(COMMON_CONVICTIONS)}`,
    `## Rules\n${bullets([...SHARED_GUARDRAILS, ...(harness.guardrails ?? [])])}`,
    `## Doctrinal profile: ${parts.profile.name}\n${parts.profile.instructions}\nStandards: ${parts.profile.standards.join('; ')}.`,
    `## Language\n${languageRule(parts.language)}`,
    `## Output\nRespond with a single JSON object, and nothing else, matching this JSON Schema:\n\`\`\`json\n${jsonSchemaOf(harness.output)}\n\`\`\``,
  ].join('\n\n');

  const user = [
    `# Task: ${harness.title}`,
    `## Method\n${numbered(harness.method)}`,
    `## Input\n\`\`\`json\n${JSON.stringify(parts.input, null, 2)}\n\`\`\``,
    `## Evidence\n\`\`\`json\n${JSON.stringify(parts.bundle, null, 2)}\n\`\`\``,
  ].join('\n\n');

  return { system, user };
}
