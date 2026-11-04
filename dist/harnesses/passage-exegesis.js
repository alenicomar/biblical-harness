import { z } from 'zod';
import { getBook } from '../core/books.js';
import { getCommentary, getCrossReferences, getPassage } from '../core/passage.js';
import { containsVerse, parseReference } from '../core/reference.js';
import { defineHarness } from '../harness/contract.js';
import { applicationSchema, COMMENTARY_IDS, confidenceSchema, disputedPointSchema, originalTranslationFor, referenceSchema, translationSchema, truncate, withTexts, } from './shared.js';
const DEFAULT_COMMENTARIES = {
    OT: ['keil-delitzsch', 'matthew-henry', 'tyndale'],
    NT: ['matthew-henry', 'jamieson-fausset-brown', 'tyndale'],
};
const input = z.object({
    reference: referenceSchema('Passage to study, e.g. "Jn 3:1-21", "Ro 8:28-39", "Sal 23".'),
    translation: translationSchema(),
    compare: z.array(z.string()).default([]).describe('Extra translation ids to compare, e.g. ["BSB", "spa_rvg"].'),
    original: z.boolean().default(true).describe('Include the Greek (SBL) or Hebrew (WLC) text.'),
    contextVerses: z.number().int().min(0).max(30).default(5).describe('Verses of surrounding context on each side.'),
    commentaries: z
        .array(z.enum(COMMENTARY_IDS))
        .optional()
        .describe('Commentary ids. Default: Keil-Delitzsch, Matthew Henry, Tyndale (OT); Matthew Henry, JFB, Tyndale (NT).'),
    commentaryCharLimit: z.number().int().min(1).default(4000).describe('Maximum characters kept per commentary note.'),
    crossReferencesPerVerse: z.number().int().min(0).max(20).default(5),
    maxCrossReferences: z.number().int().min(0).max(60).default(15),
    minCrossReferenceScore: z.number().default(5).describe('Minimum OpenBible vote score for a cross reference.'),
});
const versesField = z.string().describe('Verse range inside the passage, e.g. "16-17".');
const output = z.object({
    reference: z.string(),
    translation: z.string(),
    summary: z.string().describe('The passage’s main point in two or three sentences.'),
    literaryContext: z.string().describe('Genre and place in the book’s flow.'),
    historicalContext: z.string().describe('Setting for the original audience; flag background not in the evidence.'),
    structure: z.array(z.object({ verses: versesField, title: z.string(), description: z.string() })),
    observations: z.array(z.object({ verses: versesField, observation: z.string() })),
    keyTerms: z.array(z.object({
        term: z.string(),
        original: z.string().optional().describe('Original-language word, only if present in the evidence.'),
        meaning: z.string(),
        verses: versesField,
    })),
    interpretation: z.array(z.object({ point: z.string(), support: z.array(z.string()), confidence: confidenceSchema })),
    disputedPoints: z.array(disputedPointSchema),
    commentaryInsights: z.array(z.object({ commentator: z.string(), verses: versesField, insight: z.string() })),
    crossReferences: z.array(z.object({ reference: z.string(), connection: z.string() })),
    theologicalThemes: z.array(z.string()),
    application: z.array(applicationSchema),
    sources: z.array(z.string()).describe('Translations, commentaries and datasets used.'),
});
export const passageExegesis = defineHarness({
    id: 'passage-exegesis',
    title: 'Passage exegesis',
    summary: 'Use when studying a specific Bible passage in depth: literary and historical context, structure, observations, key terms, classical commentaries, cross references and application, following the grammatical-historical method.',
    input,
    output,
    method: [
        'Read the passage in the main translation, then its surrounding context and section headings; identify the genre and where the passage sits in the book’s argument.',
        'Compare the other translations and the original text when given; note meaningful differences and the key terms.',
        'Outline the structure: units, movements and the connectors that join them.',
        'Record observations verse by verse: people, actions, setting, repetitions, contrasts, commands, promises.',
        'Describe the historical and cultural setting only as far as the evidence and well-established background allow, flagging background not in the evidence.',
        'Interpret the author’s intended meaning for the original audience, with supporting references and a confidence level for each point.',
        'Read the classical commentaries: summarize their insights, attribute each one, and note where they agree or disagree.',
        'Follow the cross references to see how the rest of Scripture illuminates the passage, including its fulfilment in Christ where the text or the New Testament warrants it.',
        'Identify disputed points and handle them according to the doctrinal profile.',
        'Draw theological themes and applications that flow from the interpretation, each as a principle with a concrete practice.',
    ],
    guardrails: [
        'Do not take a commentator’s devotional application as the meaning of the passage.',
        'Ground Christ-centred readings in the text or in explicit New Testament use; do not impose them.',
        'Every application must follow from an interpretation point stated in the report.',
    ],
    async gather(params, { client }) {
        const ref = parseReference(params.reference);
        const book = getBook(ref.book);
        const passage = await getPassage(client, params.translation, ref);
        const sources = [`Translation: ${passage.translation.name} (${passage.translation.id})`];
        const comparisons = [];
        for (const id of params.compare) {
            const compared = await getPassage(client, id, ref);
            comparisons.push(compared);
            sources.push(`Translation: ${compared.translation.name} (${compared.translation.id})`);
        }
        let original;
        if (params.original) {
            original = await getPassage(client, originalTranslationFor(book.id), ref);
            sources.push(`Original text: ${original.translation.name} (${original.translation.id})`);
        }
        const commentaries = [];
        const unavailableCommentaries = [];
        for (const id of params.commentaries ?? DEFAULT_COMMENTARIES[book.testament]) {
            const excerpt = await getCommentary(client, id, ref);
            if (!excerpt) {
                unavailableCommentaries.push(id);
                continue;
            }
            excerpt.notes = excerpt.notes.map((note) => ({ ...note, text: truncate(note.text, params.commentaryCharLimit) }));
            excerpt.introductions = excerpt.introductions.map((intro) => ({ ...intro, text: truncate(intro.text, params.commentaryCharLimit) }));
            commentaries.push(excerpt);
            sources.push(`Commentary: ${excerpt.commentary.name}`);
        }
        const links = (await getCrossReferences(client, ref, {
            minScore: params.minCrossReferenceScore,
            limitPerVerse: params.crossReferencesPerVerse,
        }))
            .filter((link) => !(link.to.book === ref.book && containsVerse(ref, link.to.startChapter, link.to.startVerse ?? 1)))
            .sort((a, b) => b.score - a.score)
            .filter((link, index, all) => all.findIndex((other) => other.reference === link.reference) === index)
            .slice(0, params.maxCrossReferences);
        const crossReferences = await withTexts(client, params.translation, links);
        sources.push('Dataset: Bible Cross References (open-cross-ref, OpenBible.info)');
        return {
            reference: passage.reference,
            book: { id: book.id, name: book.es, testament: book.testament },
            passage,
            context: await surroundingContext(client, params.translation, ref, params.contextVerses),
            comparisons,
            original,
            commentaries,
            unavailableCommentaries,
            crossReferences,
            sources,
        };
    },
});
/** Verses just before and after a verse-bounded passage, within its first and last chapters. */
async function surroundingContext(client, translation, ref, size) {
    if (size === 0 || ref.startVerse === undefined || ref.endVerse === undefined)
        return { before: [], after: [] };
    const before = ref.startVerse > 1
        ? (await getPassage(client, translation, {
            book: ref.book,
            startChapter: ref.startChapter,
            startVerse: Math.max(1, ref.startVerse - size),
            endChapter: ref.startChapter,
            endVerse: ref.startVerse - 1,
        })).verses
        : [];
    const after = (await getPassage(client, translation, {
        book: ref.book,
        startChapter: ref.endChapter,
        startVerse: ref.endVerse + 1,
        endChapter: ref.endChapter,
        endVerse: ref.endVerse + size,
    })).verses;
    return { before, after };
}
