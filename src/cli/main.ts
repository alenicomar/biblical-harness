#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { FileCache, MemoryCache } from '../core/cache.ts';
import { BibleApiClient } from '../core/client.ts';
import { getCrossReferences, getPassage } from '../core/passage.ts';
import { parseReference } from '../core/reference.ts';
import { gatherEvidence, runHarness, type AnyHarness } from '../harness/contract.ts';
import { AnthropicProvider } from '../harness/llm.ts';
import { buildPrompt } from '../harness/prompt.ts';
import { DEFAULT_PROFILE_ID, PROFILES, type DoctrinalProfile } from '../harness/profiles.ts';
import { renderSkill } from '../harness/skill.ts';
import { HARNESSES } from '../harnesses/index.ts';
import { DEFAULT_TRANSLATION } from '../harnesses/shared.ts';

export interface CliIo {
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  /** Fetch used for the Bible API and the model provider. Defaults to the global one. */
  fetch?: typeof fetch;
  /** Base for relative paths (`--input @file`, `--out`). Defaults to the process cwd. */
  cwd?: string;
}

/** Wrong invocation: exit code 2. Anything else that is thrown is a runtime error: exit code 1. */
class UsageError extends Error {
  readonly hint: string;

  constructor(message: string, hint = 'Run "biblical-harness --help" for usage.') {
    super(message);
    this.name = 'UsageError';
    this.hint = hint;
  }
}

type OptionSpec = Record<string, { type: 'string' | 'boolean' }>;
type Values = Record<string, string | boolean | undefined>;

interface CommandContext {
  values: Values;
  positionals: string[];
  client: BibleApiClient;
  io: Required<Pick<CliIo, 'stdout' | 'stderr'>> & { fetch: typeof fetch | undefined; cwd: string };
}

interface Command {
  name: string;
  summary: string;
  usage: string[];
  options: OptionSpec;
  /** Option descriptions for --help, in the order they are shown. */
  optionHelp: string[];
  run(context: CommandContext): Promise<void>;
}

const GLOBAL_HELP = [
  '--no-cache           Keep API responses in memory only (default: file cache, see BIBLICAL_HARNESS_CACHE_DIR)',
  '-h, --help           Show help',
];

const HARNESS_OPTION_HELP = [
  '--input <json|@file>  Harness input as JSON, or @path to read it from a file (required)',
  `--profile <id>       Doctrinal profile (default: ${DEFAULT_PROFILE_ID}; see "biblical-harness profiles")`,
  '--lang <code>        Output language (default: es)',
];
const HARNESS_OPTIONS: OptionSpec = {
  input: { type: 'string' },
  profile: { type: 'string' },
  lang: { type: 'string' },
};

const lines = (rows: readonly string[]) => `${rows.join('\n')}\n`;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function integerOption(values: Values, name: string, fallback: number): number {
  const raw = values[name];
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new UsageError(`--${name} expects a non-negative integer, got "${String(raw)}".`);
  return Number(raw);
}

function requireArg(positionals: string[], index: number, label: string, command: string): string {
  const value = positionals[index];
  if (value === undefined) throw new UsageError(`Missing ${label} argument.`, `Run "biblical-harness ${command} --help" for usage.`);
  return value;
}

function findHarness(id: string): AnyHarness {
  const harness = HARNESSES.find((h) => h.id === id);
  if (!harness) throw new UsageError(`Unknown harness "${id}". Available: ${HARNESSES.map((h) => h.id).join(', ')}.`);
  return harness;
}

function findProfile(id: string): DoctrinalProfile {
  const profile = PROFILES.find((p) => p.id === id);
  if (!profile) throw new UsageError(`Unknown doctrinal profile "${id}". Valid profiles: ${PROFILES.map((p) => p.id).join(', ')}.`);
  return profile;
}

async function readInput(values: Values, cwd: string): Promise<unknown> {
  const raw = values.input;
  if (typeof raw !== 'string') throw new UsageError('--input is required: pass JSON or @path/to/file.json.', 'Run "biblical-harness gather --help" for usage.');
  let text = raw;
  if (raw.startsWith('@')) {
    const path = resolve(cwd, raw.slice(1));
    try {
      text = await readFile(path, 'utf8');
    } catch {
      throw new UsageError(`--input: cannot read file ${path}.`);
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new UsageError('--input is not valid JSON.');
  }
}

/** Resolves the harness, profile, language and input shared by gather, prompt and run. */
async function harnessRequest(context: CommandContext, command: string) {
  const harness = findHarness(requireArg(context.positionals, 0, '<harness>', command));
  const profile = findProfile((context.values.profile as string | undefined) ?? DEFAULT_PROFILE_ID);
  const language = (context.values.lang as string | undefined) ?? 'es';
  const input = await readInput(context.values, context.io.cwd);
  return { harness, input, harnessContext: { client: context.client, profile, language } };
}

function formatVerses(verses: Array<{ chapter: number; verse: number; text: string }>): string[] {
  const multiChapter = new Set(verses.map((v) => v.chapter)).size > 1;
  return verses.map((v) => `${multiChapter ? `${v.chapter}:` : ''}${v.verse} ${v.text}`);
}

const COMMANDS: Command[] = [
  {
    name: 'passage',
    summary: 'Print the text of a passage',
    usage: ['biblical-harness passage <ref> [--translation <id>] [--json]'],
    options: { translation: { type: 'string' }, json: { type: 'boolean' } },
    optionHelp: [`--translation <id>  Translation id (default: ${DEFAULT_TRANSLATION})`, '--json              Print the Passage object as JSON'],
    async run({ values, positionals, client, io }) {
      const ref = parseReference(requireArg(positionals, 0, '<ref>', 'passage'));
      const passage = await getPassage(client, (values.translation as string | undefined) ?? DEFAULT_TRANSLATION, ref);
      if (values.json) return io.stdout(json(passage));
      io.stdout(lines([`${passage.reference} (${passage.translation.name})`, ...formatVerses(passage.verses)]));
    },
  },
  {
    name: 'xref',
    summary: 'List cross references of a passage (open-cross-ref)',
    usage: ['biblical-harness xref <ref> [--limit <n>] [--min-score <n>] [--json]'],
    options: { limit: { type: 'string' }, 'min-score': { type: 'string' }, json: { type: 'boolean' } },
    optionHelp: ['--limit <n>        Links kept per verse, strongest first (default: 5)', '--min-score <n>    Drop links voted below this score (default: 0)', '--json             Print the links as JSON'],
    async run({ values, positionals, client, io }) {
      const ref = parseReference(requireArg(positionals, 0, '<ref>', 'xref'));
      const links = await getCrossReferences(client, ref, {
        limitPerVerse: integerOption(values, 'limit', 5),
        minScore: integerOption(values, 'min-score', 0),
      });
      if (values.json) return io.stdout(json(links));
      if (links.length > 0) io.stdout(lines(links.map((l) => `${l.from.chapter}:${l.from.verse} -> ${l.reference} (${l.score})`)));
    },
  },
  {
    name: 'translations',
    summary: 'List available translations',
    usage: ['biblical-harness translations [--lang <iso639-3>]'],
    options: { lang: { type: 'string' } },
    optionHelp: ['--lang <code>     Only translations in this language, e.g. spa, eng'],
    async run({ values, client, io }) {
      const { translations } = await client.availableTranslations();
      const shown = values.lang ? translations.filter((t) => t.language === values.lang) : translations;
      if (shown.length > 0) io.stdout(lines(shown.map((t) => `${t.id} | ${t.name} | ${t.englishName ?? t.name}`)));
    },
  },
  {
    name: 'commentaries',
    summary: 'List available commentaries',
    usage: ['biblical-harness commentaries'],
    options: {},
    optionHelp: [],
    async run({ client, io }) {
      const { commentaries } = await client.availableCommentaries();
      if (commentaries.length > 0) io.stdout(lines(commentaries.map((c) => `${c.id} | ${c.name}`)));
    },
  },
  {
    name: 'harnesses',
    summary: 'List the available analyses',
    usage: ['biblical-harness harnesses'],
    options: {},
    optionHelp: [],
    async run({ io }) {
      io.stdout(lines(HARNESSES.map((h) => `${h.id}: ${h.summary}`)));
    },
  },
  {
    name: 'profiles',
    summary: 'List doctrinal profiles, or show one',
    usage: ['biblical-harness profiles', 'biblical-harness profiles show <id>'],
    options: {},
    optionHelp: [],
    async run({ positionals, io }) {
      if (positionals.length === 0) {
        io.stdout(lines(PROFILES.map((p) => `${p.id}${p.id === DEFAULT_PROFILE_ID ? ' (default)' : ''} | ${p.name} | ${p.nameEs}`)));
        return;
      }
      if (positionals[0] !== 'show') throw new UsageError(`Unknown profiles subcommand "${positionals[0]}".`, 'Run "biblical-harness profiles --help" for usage.');
      const profile = findProfile(requireArg(positionals, 1, '<id>', 'profiles'));
      io.stdout(
        lines([
          `${profile.name} (${profile.nameEs})`,
          profile.summary,
          '',
          `Standards: ${profile.standards.join('; ')}`,
          `Emphases: ${profile.emphases.join('; ')}`,
          '',
          'Instructions:',
          profile.instructions,
        ]),
      );
    },
  },
  {
    name: 'gather',
    summary: 'Print the evidence bundle of a harness as JSON (what skills run)',
    usage: ['biblical-harness gather <harness> --input <json|@file> [--profile <id>] [--lang <code>]'],
    options: HARNESS_OPTIONS,
    optionHelp: HARNESS_OPTION_HELP,
    async run(context) {
      const { harness, input, harnessContext } = await harnessRequest(context, 'gather');
      const { bundle } = await gatherEvidence(harness, input, harnessContext);
      context.io.stdout(json(bundle));
    },
  },
  {
    name: 'prompt',
    summary: 'Print the pipeline prompt of a harness (dry run, no API key needed)',
    usage: ['biblical-harness prompt <harness> --input <json|@file> [--profile <id>] [--lang <code>]'],
    options: HARNESS_OPTIONS,
    optionHelp: HARNESS_OPTION_HELP,
    async run(context) {
      const { harness, input, harnessContext } = await harnessRequest(context, 'prompt');
      const gathered = await gatherEvidence(harness, input, harnessContext);
      const prompt = buildPrompt(harness, { ...gathered, profile: harnessContext.profile, language: harnessContext.language });
      context.io.stdout(`# SYSTEM\n${prompt.system}\n\n# USER\n${prompt.user}\n`);
    },
  },
  {
    name: 'run',
    summary: 'Run the pipeline with Anthropic (needs ANTHROPIC_API_KEY) and print the validated report JSON',
    usage: ['biblical-harness run <harness> --input <json|@file> [--profile <id>] [--lang <code>] [--model <id>] [--max-tokens <n>]'],
    options: { ...HARNESS_OPTIONS, model: { type: 'string' }, 'max-tokens': { type: 'string' } },
    optionHelp: [...HARNESS_OPTION_HELP, '--model <id>        Model id (default: $BIBLICAL_HARNESS_MODEL, else claude-sonnet-5-5)', '--max-tokens <n>    Maximum output tokens (default: 8000)'],
    async run(context) {
      const { harness, input, harnessContext } = await harnessRequest(context, 'run');
      const maxTokens = context.values['max-tokens'] === undefined ? undefined : integerOption(context.values, 'max-tokens', 0);
      const provider = new AnthropicProvider({ model: context.values.model as string | undefined, fetch: context.io.fetch });
      const { report } = await runHarness(harness, input, { ...harnessContext, provider, maxTokens });
      context.io.stdout(json(report));
    },
  },
  {
    name: 'skills',
    summary: 'Generate the SKILL.md of every harness, or install them for your agents',
    usage: ['biblical-harness skills build [--out <dir>]', 'biblical-harness skills install [--dir <dir>]'],
    options: { out: { type: 'string' }, dir: { type: 'string' } },
    optionHelp: [
      '--out <dir>        build: output directory (default: skills)',
      '--dir <dir>        install: user skills directory (default: ~/.agents/skills)',
    ],
    async run({ values, positionals, io }) {
      const subcommand = positionals[0];
      if (subcommand !== 'build' && subcommand !== 'install') {
        throw new UsageError('Expected the subcommand "skills build" or "skills install".', 'Run "biblical-harness skills --help" for usage.');
      }
      const foreign = subcommand === 'build' ? ['dir', 'install'] : ['out', 'build'];
      if (values[foreign[0]!] !== undefined) {
        throw new UsageError(`--${foreign[0]} only applies to "skills ${foreign[1]}".`, 'Run "biblical-harness skills --help" for usage.');
      }
      const out =
        subcommand === 'build'
          ? resolve(io.cwd, (values.out as string | undefined) ?? 'skills')
          : resolve(io.cwd, (values.dir as string | undefined) ?? join(homedir(), '.agents', 'skills'));
      for (const harness of HARNESSES) {
        const path = join(out, harness.id, 'SKILL.md');
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, renderSkill(harness), 'utf8');
        io.stdout(`${path}\n`);
      }
    },
  },
];

function rootHelp(): string {
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  return lines([
    'biblical-harness: Bible-study harnesses over the Free Use Bible API (https://bible.helloao.org/docs/)',
    '',
    'Usage: biblical-harness <command> [options]',
    '',
    'Commands:',
    ...COMMANDS.map((c) => `  ${c.name.padEnd(width)}  ${c.summary}`),
    '',
    'Run "biblical-harness <command> --help" for the options of a command.',
    '',
    'Global options:',
    ...alignRows(GLOBAL_HELP).map((row) => `  ${row}`),
  ]);
}

/** Pads the flag column of "<flag>  <description>" rows so descriptions line up; other rows pass through. */
function alignRows(rows: readonly string[]): string[] {
  const split = rows.map((row) => /^(-.*?\S)\s{2,}(.*)$/.exec(row));
  const width = Math.max(...split.map((match) => match?.[1]?.length ?? 0));
  return rows.map((row, index) => {
    const match = split[index];
    return match ? `${match[1]!.padEnd(width)}  ${match[2]}` : row;
  });
}

function commandHelp(command: Command): string {
  return lines([
    ...command.usage.map((usage, index) => `${index === 0 ? 'Usage: ' : '       '}${usage}`),
    '',
    command.summary,
    '',
    'Options:',
    ...alignRows([...command.optionHelp, ...GLOBAL_HELP]).map((row) => `  ${row}`),
  ]);
}

export async function main(argv: string[], io: CliIo = {}): Promise<number> {
  const stdout = io.stdout ?? ((text: string) => void process.stdout.write(text));
  const stderr = io.stderr ?? ((text: string) => void process.stderr.write(text));
  const [name, ...rest] = argv;

  try {
    if (name === undefined || name === '--help' || name === '-h') {
      stdout(rootHelp());
      return 0;
    }
    const command = COMMANDS.find((c) => c.name === name);
    if (!command) throw new UsageError(`Unknown command "${name}".`);

    let parsed;
    try {
      parsed = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { ...command.options, 'no-cache': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
      });
    } catch (error) {
      throw new UsageError((error as Error).message, `Run "biblical-harness ${command.name} --help" for usage.`);
    }
    if (parsed.values.help) {
      stdout(commandHelp(command));
      return 0;
    }

    const client = new BibleApiClient({ fetch: io.fetch, cache: parsed.values['no-cache'] ? new MemoryCache() : new FileCache() });
    await command.run({
      values: parsed.values as Values,
      positionals: parsed.positionals,
      client,
      io: { stdout, stderr, fetch: io.fetch, cwd: io.cwd ?? process.cwd() },
    });
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      stderr(`biblical-harness: ${error.message}\n${error.hint}\n`);
      return 2;
    }
    stderr(`biblical-harness: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

// Set exitCode instead of calling process.exit so piped output is flushed first.
if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
