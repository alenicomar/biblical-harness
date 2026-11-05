# word-study-and-background

Two new harnesses built in parallel on the existing contract: a Hebrew/Greek word study (bsb-interlinear + stepbible-lexicon) and a people/places/chronology study (theographic + history-globe).

## Specs

- **S1** — Request (verbatim): "Vamos con 1 y 2 en paralelo", where 1 = "**Harness de estudio de palabras:** hebreo y griego, con el interlineal BSB (`bsb-interlinear`) y los léxicos de STEPBible (`stepbible-lexicon`)." and 2 = "**Personas, lugares y cronología:** con `theographic` y `history-globe`."
- **S2** — Both harnesses follow the existing dual-face contract (skill + pipeline), shared guardrails and doctrinal profiles (`odd/tasks/bible-ai-foundation.md` S4, S7).
- **S3** — Word study: given a passage and a word (or a Strong's number), gather the interlinear words, the lexicon entry and the word's occurrences, so the report can explain meaning, semantic range and usage without word-study fallacies.
- **S4** — People/places/chronology: given a passage or an entity name, gather the people, places (with coordinates) and events involved, with dates, relations and references, ordered as a timeline.

## Tasks

- [x] **T1** — S2 — inline — Client accessors for lexicon entries and dataset indexes/entities (`src/core/client.ts`). Commit: 3086cc6
- [ ] **T2** — S1, S3 — worker A — `word-study` harness + `src/core/interlinear.ts`. Commit: —
- [ ] **T3** — S1, S4 — worker B — `people-places-timeline` harness + `src/core/theographic.ts`. Commit: —
- [ ] **T4** — S1, S2 — inline — Integration: register both, regenerate skills and dist, README, live smoke. Commit: —

## Log

- **L1** — User request (verbatim): "Vamos con 1 y 2 en paralelo".
- **L2** — Evidence (API exploration): interlinear chapter `chapter.content[] = { verse, words[]: { pos, bsbPos, language, text, transliteration, parsing, parsingFull, strongs ("G0025"), gloss|null } }`. Lexicon: `d/stepbible-lexicon/lexicon/{G0025}.json` → `entry: { id, language, senses[]: { id, language, lemma, transliteration, partOfSpeech, gloss, definition } }`; unpadded ids (`G25`) are 404; `lexicon.json` lists 18085 `{ id, language, name }`; no chapter files. Theographic chapter: `chapter: { number, people[], places[], events[] }`, items `{ id, name, apiLink, verses[] }` (+ gender / featureType, latitude, longitude / startDate). Entities: `d/theographic/{people|places|events|groups}/{id}.json` → `{ person|place|event|group }`; person fields include alsoCalled, gender, description[] (Easton's), birthYear, deathYear, minYear, maxYear, birthPlace, deathPlace, father, mother, partners, children, siblings, memberOf, events[], references[]; event: startDate (string year, negative BC), duration, participants[], predecessor, references[]. Indexes: `people.json` (3067), `places.json` (1274), `events.json` (450), `groups.json` (23). History Globe: `d/history-globe/places.json` (1231) and `places/{id}.json` → `place: { id, name, featureType, latitude, longitude, references[] }`; its chapter files have only `places`. Missing files are 404 (HTML body).
