import { z } from 'zod';
import { getBook } from '../core/books.js';
import { getPassage } from '../core/passage.js';
import { parseReference } from '../core/reference.js';
/** Commentaries published by the API (all English). */
export const COMMENTARY_IDS = [
    'matthew-henry',
    'john-calvin',
    'john-gill',
    'keil-delitzsch',
    'jamieson-fausset-brown',
    'adam-clarke',
    'tyndale',
];
export const DEFAULT_TRANSLATION = 'spa_r09';
/** Critical original-language texts: SBL Greek NT and the Westminster Leningrad Codex. */
export function originalTranslationFor(bookId) {
    return getBook(bookId).testament === 'NT' ? 'grc_sbl' : 'hbo_wlc';
}
/** A string that must parse as a Bible reference; the parser's message becomes the issue. */
export function referenceSchema(description) {
    return z
        .string()
        .describe(description)
        .superRefine((value, ctx) => {
        try {
            parseReference(value);
        }
        catch (error) {
            ctx.addIssue({ code: 'custom', message: error.message });
        }
    });
}
export function translationSchema() {
    return z.string().default(DEFAULT_TRANSLATION).describe('API translation id, e.g. "spa_r09" (Reina-Valera 1909), "BSB".');
}
export function truncate(text, limit) {
    return text.length > limit ? `${text.slice(0, limit)} […truncated]` : text;
}
/** Attaches the text of each cross-reference target in the given translation. */
export async function withTexts(client, translation, refs) {
    const linked = [];
    for (const ref of refs) {
        const passage = await getPassage(client, translation, ref.to);
        linked.push({ ...ref, text: passage.verses.map((v) => v.text).join(' ') });
    }
    return linked;
}
/** Shared report building blocks. */
export const confidenceSchema = z.enum(['high', 'medium', 'low']);
export const disputedPointSchema = z.object({
    question: z.string(),
    positions: z.array(z.object({
        tradition: z.string().describe('Tradition holding the view, e.g. "Reformed", "Arminian".'),
        view: z.string(),
        support: z.array(z.string()).describe('References supporting the view.'),
    })),
});
export const applicationSchema = z.object({
    principle: z.string().describe('Timeless truth drawn from the interpretation.'),
    practice: z.string().describe('Concrete response for the church or the believer today.'),
});
