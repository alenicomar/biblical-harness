import { z } from 'zod';
import { getBook } from '../core/books.ts';
import type { BibleApiClient } from '../core/client.ts';
import { getPassage, type CrossReference } from '../core/passage.ts';
import { parseReference } from '../core/reference.ts';

/** Commentaries published by the API (all English). */
export const COMMENTARY_IDS = [
  'matthew-henry',
  'john-calvin',
  'john-gill',
  'keil-delitzsch',
  'jamieson-fausset-brown',
  'adam-clarke',
  'tyndale',
] as const;

export const DEFAULT_TRANSLATION = 'spa_r09';

/** Critical original-language texts: SBL Greek NT and the Westminster Leningrad Codex. */
export function originalTranslationFor(bookId: string): string {
  return getBook(bookId).testament === 'NT' ? 'grc_sbl' : 'hbo_wlc';
}

/** A string that must parse as a Bible reference; the parser's message becomes the issue. */
export function referenceSchema(description: string) {
  return z
    .string()
    .describe(description)
    .superRefine((value, ctx) => {
      try {
        parseReference(value);
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: (error as Error).message });
      }
    });
}

export function translationSchema() {
  return z.string().default(DEFAULT_TRANSLATION).describe('API translation id, e.g. "spa_r09" (Reina-Valera 1909), "BSB".');
}

export function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)} […truncated]` : text;
}

export interface LinkedPassage extends CrossReference {
  text: string;
}

/** Attaches the text of each cross-reference target in the given translation. */
export async function withTexts(
  client: BibleApiClient,
  translation: string,
  refs: readonly CrossReference[],
): Promise<LinkedPassage[]> {
  const linked: LinkedPassage[] = [];
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
  positions: z.array(
    z.object({
      tradition: z.string().describe('Tradition holding the view, e.g. "Reformed", "Arminian".'),
      view: z.string(),
      support: z.array(z.string()).describe('References supporting the view.'),
    }),
  ),
});

export const applicationSchema = z.object({
  principle: z.string().describe('Timeless truth drawn from the interpretation.'),
  practice: z.string().describe('Concrete response for the church or the believer today.'),
});
