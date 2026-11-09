# Theographic review findings

Address the advisory findings of native review `review-105e36db00dd5a77` (commits 7c362f2, fce273a), then deliver.
Branch: `fix/theographic-review-findings`. Workers do not commit or run `npm run build`; the parent builds, checks and commits.

## Specs

- S1 (R2-circular-import, `src/core/spanish-names.ts:1`): `spanish-names.ts` imports `normalizeName` from `theographic.ts`, which imports `spanishToEnglishName` from `spanish-names.ts`. Break the cycle; `theographic.ts` keeps exporting `normalizeName`.
- S2 (R3-fallback-shadowed-by-direct-hit, R2-undocumented-fallback-precedence, `src/core/theographic.ts:241-244`): `searchEntities` returns direct hits whenever there is any, so a Spanish name with a known translation can be shadowed by an unrelated substring/prefix hit (e.g. "José" -> substring of "Joses" instead of "Joseph"). Results for a name with a known translation must include the translated matches ranked ahead of non-exact direct hits, and the precedence must be documented in the doc comment.
- S3 (R3-fallback-coverage-gaps, R2-test-name-overclaims, `test/core/theographic.test.ts:165-167`): tests must cover the fallback cases the rule names (translation used when no direct hit, translation not shadowed by a partial direct hit, exact direct hit kept, unknown name with no hit returns []), and test names must claim only what they assert.
- S4 (R2-dead-identity-entries, `src/core/spanish-names.ts:10-29`): entries whose normalized value equals the key (e.g. `abraham: 'Abraham'`, `david: 'David'`) are dead; remove them and pin that no identity entry remains.
- S5 (R2-misleading-map-doc, `src/core/spanish-names.ts:4-6`): the doc comment ("identical ones (David, Moses→Moses) need no entry") is self-contradictory; rewrite it to match the map.
- S6 (R2-bundled-frontmatter-fix, `src/harness/skill.ts:19`): SUGGESTION about the frontmatter fix sharing a review candidate with an unrelated feature; no code change.

## Tasks

- T1 [S1] inline (parent): extract `normalizeName` to `src/core/names.ts`. Commit: 8b2ef4c, 4ba4be9
- T2 [S2, S3] worker A: `src/core/theographic.ts`, `test/core/theographic.test.ts`. Commit: 8b2ef4c
- T3 [S4, S5] worker B: `src/core/spanish-names.ts`, `test/core/spanish-names.test.ts`. Commit: 4ba4be9
- T4 [S6] dropped: informational, no change.
- T5 build `dist/`, `npm run check`, commit work units, push, PR, merge. Commit: this document

## Log

- L1 (user, verbatim): "Encarala en paralelo, luego commitealas, pusheá, armá la PR y mergeala"
- L2: finding texts are not available beyond id, lens, location and severity; specs are derived from the ids and the code at those locations.
- L3: T2 and T3 ran as parallel workers; `npm run check` 160/160 after `npm run build`. T2 changed the expected order to Joseph, Josephus, Joses (translated prefix matches rank before partial direct hits).
- L4: independent verify after merge (b69ff5c): S3 FAIL. T3 removed `david`, so the "returns each entity once" test (Davíd) no longer ran a translated query and passed with dedupe disabled; the José ranking comment was also wrong. Fixed with a José/Joseph overlap test (RED with dedupe disabled in a scratch copy, GREEN 160/160) on branch test/theographic-dedupe-overlap.
