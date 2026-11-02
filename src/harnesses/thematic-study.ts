import { z } from 'zod';
import { getBook } from '../core/books.ts';
import { getCrossReferences, getPassage } from '../core/passage.ts';
import { containsVerse, parseReference, type PassageRef } from '../core/reference.ts';
import { defineHarness } from '../harness/contract.ts';
import { applicationSchema, disputedPointSchema, referenceSchema, translationSchema } from './shared.ts';

const input = z.object({
  theme: z.string().min(2).describe('Theme or doctrine to trace, e.g. "justificación por la fe", "el pacto", "el Espíritu Santo".'),
  seeds: z
    .array(referenceSchema('Seed passage that states or illustrates the theme, e.g. "Ro 3:21-28".'))
    .min(1)
    .max(10)
    .describe('Passages the study starts from. The API has no full-text search, so the theme is traced by following cross references from these.'),
  translation: translationSchema(),
  depth: z
    .number()
    .int()
    .min(1)
    .max(2)
    .default(1)
    .describe('1 follows cross references from the seeds; 2 also follows them from the depth-1 targets.'),
  crossReferencesPerVerse: z.number().int().min(1).max(20).default(5),
  minCrossReferenceScore: z.number().default(10).describe('Minimum OpenBible vote score for a cross reference.'),
  maxPassages: z.number().int().min(1).max(80).default(30).describe('Maximum linked passages kept, highest aggregate score first.'),
});

const output = z.object({
  theme: z.string(),
  definition: z.string().describe('The theme as the seed passages define it, in two or three sentences.'),
  canonicalProgression: z
    .array(
      z.object({
        section: z.string().describe('Canonical section, e.g. "Law", "Wisdom & Poetry", "Gospels".'),
        passages: z.array(z.string()).describe('References from that section that carry explicit or conceptual links.'),
        contribution: z.string().describe('What this section adds to the theme and how it develops earlier revelation.'),
      }),
    )
    .describe('Sections in canonical order; omit sections without usable passages.'),
  keyPassages: z.array(z.object({ reference: z.string(), role: z.string().describe('Why the passage is pivotal for the theme.') })),
  synthesis: z.string().describe('The biblical theology of the theme across the canon.'),
  christologicalFocus: z.string().describe('How the theme finds fulfilment in Christ, only as far as the texts warrant.'),
  disputedPoints: z.array(disputedPointSchema),
  application: z.array(applicationSchema),
  gaps: z.array(z.string()).describe('Aspects of the theme the evidence does not cover.'),
  sources: z.array(z.string()).describe('Translations and datasets used.'),
});

export interface ThematicBundle {
  theme: string;
  seeds: Array<{ reference: string; text: string }>;
  passages: Array<{
    reference: string;
    ref: PassageRef;
    book: string;
    testament: 'OT' | 'NT';
    section: string;
    /** Sum of the OpenBible vote scores of every link reaching this passage. */
    score: number;
    /** Fewest cross-reference hops from a seed. */
    depth: 1 | 2;
    /** Seeds (depth 1) or linked passages (depth 2) whose cross references point here. */
    linkedFrom: string[];
    text: string;
  }>;
  sources: string[];
}

/** A linked passage while it is being aggregated, before its text is attached. */
type LinkedTarget = Pick<ThematicBundle['passages'][number], 'reference' | 'ref' | 'score' | 'depth' | 'linkedFrom'>;

export const thematicStudy = defineHarness({
  id: 'thematic-study',
  title: 'Thematic study',
  summary:
    'Use when tracing a theme or doctrine across the canon from seed passages via cross references: how it is introduced, developed and fulfilled from Law to Apocalypse, with Christ at the centre.',
  input,
  output,
  method: [
    'Define the theme from the seed passages, reading each in its own context before drawing on it.',
    'Trace the theme through the canon section by section, in canonical order, using the linked passages.',
    'For each linked passage judge whether the link is explicit (same words or a quotation), conceptual, or weak; discard weak links explicitly instead of silently.',
    'Observe progressive revelation: how later texts develop, qualify or fulfil earlier ones.',
    'Show the fulfilment of the theme in Christ where the texts warrant it.',
    'Identify disputed points and handle them according to the doctrinal profile.',
    'Synthesize the biblical theology of the theme from the passages kept.',
    'Draw applications, each as a principle with a concrete practice.',
    'Report the gaps: aspects of the theme the evidence leaves uncovered.',
  ],
  guardrails: [
    'Cross references come from crowd-sourced OpenBible votes: they are a starting point, not proof. Judge each link yourself.',
    'Never claim the evidence is exhaustive: the API has no full-text search, so the passages depend on the seeds and the cross-reference dataset.',
    'Avoid proof-texting: read each passage in its own context before using it for the theme.',
  ],
  async gather(params, { client }): Promise<ThematicBundle> {
    const seedRefs = params.seeds.map((seed) => parseReference(seed));
    const seeds: ThematicBundle['seeds'] = [];
    let translation = params.translation;
    for (const ref of seedRefs) {
      const passage = await getPassage(client, params.translation, ref);
      translation = `${passage.translation.name} (${passage.translation.id})`;
      seeds.push({ reference: passage.reference, text: joinVerses(passage.verses) });
    }

    const found = new Map<string, LinkedTarget>();
    const expand = async (sources: ReadonlyArray<{ ref: PassageRef; reference: string }>, depth: 1 | 2) => {
      const reached = new Set<string>();
      for (const source of sources) {
        const links = await getCrossReferences(client, source.ref, {
          minScore: params.minCrossReferenceScore,
          limitPerVerse: params.crossReferencesPerVerse,
        });
        for (const link of links) {
          if (insideSeeds(seedRefs, link.to)) continue;
          const known = found.get(link.reference);
          if (!known) {
            found.set(link.reference, { reference: link.reference, ref: link.to, score: link.score, depth, linkedFrom: [source.reference] });
          } else {
            known.score += link.score;
            if (!known.linkedFrom.includes(source.reference)) known.linkedFrom.push(source.reference);
          }
          reached.add(link.reference);
        }
      }
      return [...reached].map((reference) => found.get(reference)!);
    };

    const firstHop = await expand(
      seedRefs.map((ref, index) => ({ ref, reference: seeds[index]!.reference })),
      1,
    );
    if (params.depth === 2) await expand(firstHop, 2);

    const kept = [...found.values()]
      .sort((a, b) => b.score - a.score || compareCanonical(a.ref, b.ref))
      .slice(0, params.maxPassages)
      .sort((a, b) => compareCanonical(a.ref, b.ref));

    const passages: ThematicBundle['passages'] = [];
    for (const target of kept) {
      const book = getBook(target.ref.book);
      const passage = await getPassage(client, params.translation, target.ref);
      passages.push({
        reference: target.reference,
        ref: target.ref,
        book: book.es,
        testament: book.testament,
        section: canonicalSection(book.id),
        score: target.score,
        depth: target.depth,
        linkedFrom: target.linkedFrom,
        text: joinVerses(passage.verses),
      });
    }

    return {
      theme: params.theme,
      seeds,
      passages,
      sources: [
        `Translation: ${translation}`,
        'Dataset: Bible Cross References (open-cross-ref, OpenBible.info)',
      ],
    };
  },
});

const SECTIONS: Array<[first: string, last: string, name: string]> = [
  ['GEN', 'DEU', 'Law'],
  ['JOS', 'EST', 'History'],
  ['JOB', 'SNG', 'Wisdom & Poetry'],
  ['ISA', 'DAN', 'Major Prophets'],
  ['HOS', 'MAL', 'Minor Prophets'],
  ['MAT', 'JHN', 'Gospels'],
  ['ACT', 'ACT', 'Acts'],
  ['ROM', 'PHM', 'Pauline Epistles'],
  ['HEB', 'JUD', 'General Epistles'],
  ['REV', 'REV', 'Apocalypse'],
];

/** Traditional canonical section of a book, by its id. */
export function canonicalSection(bookId: string): string {
  const order = getBook(bookId).order;
  const section = SECTIONS.find(([first, last]) => order >= getBook(first).order && order <= getBook(last).order);
  if (!section) throw new Error(`No canonical section for book ${bookId}`);
  return section[2];
}

function joinVerses(verses: ReadonlyArray<{ text: string }>): string {
  return verses.map((v) => v.text).join(' ');
}

/** True when the target's first verse lies inside one of the seeds. */
function insideSeeds(seeds: readonly PassageRef[], target: PassageRef): boolean {
  return seeds.some((seed) => seed.book === target.book && containsVerse(seed, target.startChapter, target.startVerse ?? 1));
}

/** Book order, then chapter, then verse. */
function compareCanonical(a: PassageRef, b: PassageRef): number {
  return (
    getBook(a.book).order - getBook(b.book).order ||
    a.startChapter - b.startChapter ||
    (a.startVerse ?? 0) - (b.startVerse ?? 0)
  );
}
