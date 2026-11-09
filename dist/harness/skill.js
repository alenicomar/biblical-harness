import { z } from 'zod';
import { SHARED_GUARDRAILS } from './guardrails.js';
import { COMMON_CONVICTIONS, DEFAULT_PROFILE_ID, PROFILES } from './profiles.js';
import { jsonSchemaOf } from './prompt.js';
const bullets = (lines) => lines.map((line) => `- ${line}`).join('\n');
const numbered = (lines) => lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
/** Skill face: a SKILL.md an agent follows, gathering evidence through the `biblical-harness` CLI. */
export function renderSkill(harness) {
    const inputSchema = JSON.stringify(z.toJSONSchema(harness.input, { io: 'input', unrepresentable: 'any' }), null, 2);
    const profiles = PROFILES.map((p) => `- \`${p.id}\`${p.id === DEFAULT_PROFILE_ID ? ' (default)' : ''}: ${p.name} (${p.nameEs}). ${p.summary}`).join('\n');
    return `---
name: ${harness.id}
description: ${JSON.stringify(harness.summary)}
---

# ${harness.title}

<!-- Generated from src/harnesses/${harness.id}.ts by \`biblical-harness skills build\`. Do not edit by hand. -->

## 1. Gather the evidence

Run the CLI and read its JSON output. Do not answer from memory: every quotation and reference must come from this evidence.

\`\`\`sh
biblical-harness gather ${harness.id} --input '<json>' [--profile <id>] [--lang <code>]
\`\`\`

Input (JSON Schema):

\`\`\`json
${inputSchema}
\`\`\`

## 2. Follow the method

${numbered(harness.method)}

## 3. Respect the guardrails

Shared convictions:

${bullets(COMMON_CONVICTIONS)}

Rules:

${bullets([...SHARED_GUARDRAILS, ...(harness.guardrails ?? [])])}

## 4. Apply the doctrinal profile

Use the profile the user asks for; otherwise \`${DEFAULT_PROFILE_ID}\`. Print its instructions with \`biblical-harness profiles show <id>\`.

${profiles}

## 5. Write the report

Write in the user's language, as a Markdown report whose sections follow this structure (the pipeline face returns it as JSON):

\`\`\`json
${jsonSchemaOf(harness.output)}
\`\`\`
`;
}
