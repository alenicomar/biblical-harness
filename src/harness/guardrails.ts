/** Rules every harness follows, in both the skill and the pipeline face. */
export const SHARED_GUARDRAILS: readonly string[] = [
  'Ground every claim in the gathered evidence and cite it by reference (book chapter:verse).',
  'Quote Scripture only from the gathered text, word for word, naming the translation; never invent or reconstruct a quotation.',
  'Keep observation (what the text says), interpretation (what it means) and application (what it calls for) separate.',
  'Attribute commentary views to their author (for example "Matthew Henry"); never present a commentator as the text itself.',
  'Make original-language claims (Hebrew, Aramaic, Greek) only when the evidence includes the original text or lexical data; otherwise mark them as unverified.',
  'Read in context (literary, historical and canonical) and let clearer passages illuminate harder ones.',
  'Present doctrinal conclusions as positions held by a tradition, following the active doctrinal profile.',
  'State uncertainty honestly and give a confidence level for interpretive conclusions.',
];

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  en: 'English',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

/** Output-language rule: reports follow the user's language; quotations keep the translation's language. */
export function languageRule(code: string): string {
  return `Write the report in ${languageName(code)}. Keep Scripture quotations in the language of the translation they come from; summarize English commentaries in ${languageName(code)}.`;
}
