import { z } from 'zod';
import { BOOKS } from '../core/books.js';
import { findOccurrences, getInterlinear, getLexiconEntry, normalizeStrongs, } from '../core/interlinear.js';
import { getPassage } from '../core/passage.js';
import { parseReference } from '../core/reference.js';
import { defineHarness } from '../harness/contract.js';
import { applicationSchema, referenceSchema, translationSchema, truncate } from './shared.js';
const input = z
    .object({
    reference: referenceSchema('Passage that contains the word, e.g. "Jn 3:16", "Ro 3:21-26".').optional(),
    word: z
        .string()
        .min(1)
        .optional()
        .describe('Word to study, matched (ignoring case and diacritics) against the interlinear gloss, transliteration or original text within the passage, e.g. "loved", "agapaō", "ἠγάπησεν".'),
    strongs: z
        .string()
        .optional()
        .describe('Strong\'s number to study instead of a word, e.g. "G25" or "H2617".')
        .superRefine((value, ctx) => {
        if (value === undefined)
            return;
        try {
            normalizeStrongs(value);
        }
        catch (error) {
            ctx.addIssue({ code: 'custom', message: error.message });
        }
    }),
    translation: translationSchema(),
    scope: z
        .enum(['passage', 'book', 'testament'])
        .optional()
        .describe('Where to count the word: only the passage, the whole book of the reference, or the whole testament of the word. Default: "book" with a reference, else "testament".'),
    maxOccurrences: z.number().int().min(1).max(100).default(30).describe('Maximum sample occurrences kept per word, in canonical order.'),
    definitionCharLimit: z.number().int().min(1).default(3000).describe('Maximum characters kept per lexicon definition.'),
})
    .superRefine((value, ctx) => {
    if (!value.strongs && !(value.reference && value.word)) {
        ctx.addIssue({ code: 'custom', message: 'give a Strong\'s number ("strongs"), or a "reference" together with a "word"' });
    }
    if (value.scope !== undefined && value.scope !== 'testament' && !value.reference) {
        ctx.addIssue({
            code: 'custom',
            path: ['scope'],
            message: `scope "${value.scope}" needs a "reference"; use scope "testament" to study a Strong's number alone`,
        });
    }
})
    .transform((value) => ({ ...value, scope: value.scope ?? (value.reference ? 'book' : 'testament') }));
const output = z.object({
    word: z.string().describe('The lemma with its transliteration, e.g. "ἀγαπάω (agapaō)".'),
    strongs: z.string(),
    language: z.string().describe('"Greek", "Hebrew" or "Aramaic".'),
    partOfSpeech: z.string(),
    lexicalMeaning: z.string().describe('What the lexicon says the word means, in two or three sentences.'),
    semanticRange: z
        .array(z.object({ sense: z.string(), references: z.array(z.string()).describe('Sampled references where this sense fits.') }))
        .describe('Senses of the word grouped from the lexicon and the sampled occurrences.'),
    usageInPassage: z.string().describe('What the word means in this passage, decided from its immediate context, with its form and parsing.'),
    distribution: z.string().describe('Where and how often the word occurs, from the counts of the scanned scope only.'),
    translationRenderings: z.array(z.object({
        rendering: z.string().describe('English rendering used by the BSB.'),
        count: z.number().optional(),
        note: z.string().describe('When this rendering is used or what it emphasises.'),
    })),
    relatedWords: z.array(z.object({
        strongs: z.string().optional(),
        word: z.string(),
        relation: z.string().describe('How it relates, as the lexicon or the interlinear shows.'),
    })),
    theologicalSignificance: z.string().describe('What the word contributes to the passage’s teaching, without loading it with every sense.'),
    fallaciesAvoided: z.array(z.string()).describe('Word-study fallacies the analysis took care to avoid, and where.'),
    application: z.array(applicationSchema),
    sources: z.array(z.string()).describe('Translations and datasets used.'),
});
export const wordStudy = defineHarness({
    id: 'word-study',
    title: 'Word study',
    summary: 'Use when studying a Hebrew or Greek word of a passage (or a Strong\'s number): its lexical meaning, semantic range, usage across the book or testament and how translations render it, avoiding word-study fallacies.',
    input,
    output,
    method: [
        'Read the passage and identify the word in the interlinear: its original form, parsing and gloss.',
        'Read the lexicon entry and list the senses it gives, without treating them as all present at once.',
        'Survey the sampled occurrences and group them by sense, noting the references for each.',
        'Decide the sense in this passage from its immediate context, not from etymology or from the lexicon’s first entry.',
        'Compare how the translation renders the word across the occurrences, using the gloss counts.',
        'Note related words only as far as the lexicon or the interlinear shows them.',
        'Draw the theological significance and application from the passage’s own use of the word.',
        'State the limits of the evidence: what was scanned and what was not.',
    ],
    guardrails: [
        'Context determines meaning: never assume a word carries the same sense everywhere.',
        'Avoid the root fallacy and etymologizing: a word’s history does not fix its meaning in a given text.',
        'Avoid illegitimate totality transfer: do not load every sense of the word into one occurrence.',
        'Avoid anachronism: do not read later meanings back, e.g. "dynamite" for dynamis.',
        'Do not overload grammar: the aorist, for example, is not "once for all" by itself.',
        'Strong’s numbers group lemmas, not senses; the same number can cover distinct uses.',
        'Counts cover only the scanned scope (passage, book or testament): never claim exhaustiveness beyond it.',
    ],
    async gather(params, { client }) {
        const ref = params.reference ? parseReference(params.reference) : undefined;
        const sources = ['BSB interlinear (public domain)'];
        const bundle = { targets: [], sources };
        let interlinear = [];
        if (ref) {
            const passage = await getPassage(client, params.translation, ref);
            bundle.reference = passage.reference;
            bundle.passage = { translation: `${passage.translation.name} (${passage.translation.id})`, verses: passage.verses };
            interlinear = await getInterlinear(client, ref);
            bundle.interlinear = interlinear;
            sources.push(`Translation: ${bundle.passage.translation}`);
        }
        const strongsList = params.strongs ? [normalizeStrongs(params.strongs)] : matchWord(interlinear, params.word, bundle.reference);
        for (const strongs of strongsList) {
            const letter = strongs[0];
            const testament = letter === 'G' ? 'NT' : 'OT';
            const books = params.scope === 'testament' ? BOOKS.filter((book) => book.testament === testament).map((b) => b.id) : [ref.book];
            const entry = await getLexiconEntry(client, strongs);
            const found = await findOccurrences(client, strongs, books, {
                max: params.maxOccurrences,
                within: params.scope === 'passage' ? ref : undefined,
            });
            const samples = [];
            for (const sample of found.samples) {
                const passage = await getPassage(client, params.translation, sample.ref);
                samples.push({ ...sample, verseText: passage.verses.map((v) => v.text).join(' ') });
            }
            const fromPassage = interlinear.flatMap((v) => v.words).find((w) => w.strongs.startsWith(strongs.slice(0, 5)));
            bundle.targets.push({
                strongs,
                language: entry?.language ?? fromPassage?.language ?? (letter === 'G' ? 'greek' : 'hebrew'),
                lexicon: entry && {
                    id: entry.id,
                    senses: entry.senses.map((sense) => ({ ...sense, definition: truncate(sense.definition, params.definitionCharLimit) })),
                },
                occurrences: { scope: params.scope, books, total: found.total, byBook: found.byBook, glosses: found.glosses, samples },
            });
        }
        if (bundle.targets.some((t) => t.lexicon))
            sources.push('STEPBible Brief Lexicons, CC BY 4.0, STEPBible.org / Tyndale House');
        return bundle;
    },
});
/** Lowercases, strips diacritics and punctuation so "ēgapēsen" matches "egapesen" and "[the]" matches "the". */
function fold(text) {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Distinct Strong's numbers of the passage words that match the term, in order of appearance. */
function matchWord(verses, term, reference) {
    const wanted = fold(term);
    const words = verses.flatMap((verse) => verse.words).filter((w) => w.strongs);
    const fields = (w) => [w.gloss ?? '', w.transliteration, w.text].map(fold);
    let matches = words.filter((w) => fields(w).some((f) => f === wanted));
    if (matches.length === 0)
        matches = words.filter((w) => fields(w).some((f) => f !== '' && f.includes(wanted)));
    if (matches.length === 0) {
        const glosses = [...new Set(words.map((w) => w.gloss).filter(Boolean))].join(', ');
        throw new Error(`No word matching "${term}" in the interlinear of ${reference}. Glosses in the passage: ${glosses || '(none)'}`);
    }
    const distinct = new Map();
    for (const w of matches) {
        const base = normalizeStrongs(w.strongs).slice(0, 5);
        if (!distinct.has(base))
            distinct.set(base, normalizeStrongs(w.strongs));
    }
    return [...distinct.values()];
}
