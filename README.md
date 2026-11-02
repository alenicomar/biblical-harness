# bible-ai

A Protestant/Evangelical Bible-study ecosystem for AI. Each analysis is a **harness**: defined once, usable by an agent as a skill and runnable as a pipeline. The data comes from the [Free Use Bible API](https://bible.helloao.org/docs/).

## Architecture

| Layer | Path | Role |
| --- | --- | --- |
| Core | `src/core` | Typed, cached API client; reference parser (`Jn 3:16-18`, `1 Co 13`); passage, commentary and cross-reference helpers |
| Harness | `src/harness` | The dual-face contract, shared guardrails, doctrinal profiles, prompt and skill renderers, LLM provider |
| Harnesses | `src/harnesses` | The analyses themselves, registered in `src/harnesses/index.ts` |
| CLI | `src/cli` | `bible-ai`: the way agents and people reach everything above |
| MCP (future) | `src/mcp` | A thin adapter, no new logic: core → MCP tools/resources, harnesses → MCP prompts |

Dependencies point one way: `cli` (and later `mcp`) → `harnesses` → `harness` → `core`.

## Harnesses

| Id | Use it to |
| --- | --- |
| `passage-exegesis` | Study a passage: literary context, structure, original text, classic commentaries, cross references, application |
| `thematic-study` | Trace a theme or doctrine through the canon from seed passages, via cross references |

`bible-ai harnesses` lists them.

## Two faces, one contract

- **Skill**: `skills/<id>/SKILL.md`, generated from the harness. An agent reads it, runs `bible-ai gather <id> --input '<json>'` to collect evidence, and writes the report itself.
- **Pipeline**: `bible-ai run <id> --input '<json>'` gathers the same evidence, asks a model (Anthropic), and validates the JSON report against the harness schema. `bible-ai prompt` shows the prompt without calling any model.

Both faces share the same input schema, evidence gathering and guardrails. Skills are never edited by hand: run `npm run skills`. A test fails when they drift from the harness definitions.

## Doctrinal profiles

Pass `--profile <id>` (default `plural`). All profiles share the core evangelical convictions and differ on secondary matters. `bible-ai profiles show <id>` prints the details.

| Id | Profile |
| --- | --- |
| `plural` (default) | Evangelical plural: presents each major Protestant reading, without taking sides |
| `reformed` | Reformed / Presbyterian |
| `baptist` | Baptist |
| `lutheran` | Lutheran |
| `wesleyan-arminian` | Wesleyan / Arminian |
| `pentecostal` | Pentecostal / Charismatic |
| `dispensational` | Dispensational |

## Data sources and caveats

- Default translation: `spa_r09` (Reina-Valera 1909). RVR1960 is not available in the API. Other texts: `bible-ai translations --lang spa`.
- Commentaries are in English (`bible-ai commentaries`). Reports are still written in the requested language (`--lang`, default `es`).
- The API has no full-text search, so a thematic study needs seed passages you choose.
- Responses are immutable, so they are cached forever in `$BIBLE_AI_CACHE_DIR`, else `$XDG_CACHE_HOME/bible-ai`, else `~/.cache/bible-ai`. Use `--no-cache` to skip the disk.
- Each text and dataset keeps its own license; check it before redistributing.

## Quick start

Requires Node ≥ 24.

```sh
npm install
npm link                      # optional: exposes `bible-ai`; otherwise use `node src/cli/main.ts`

bible-ai passage "Jn 3:16-18"
bible-ai xref "Ro 8:28" --limit 3
bible-ai gather passage-exegesis --input '{"reference":"Ro 8:28-39"}'
bible-ai prompt thematic-study --input '{"theme":"justificación por la fe","seeds":["Ro 3:21-26","Gá 2:16"]}' --profile reformed
ANTHROPIC_API_KEY=... bible-ai run passage-exegesis --input @exegesis.json --profile baptist
```

`--input` takes JSON or `@file.json`. Every command has `--help`. Exit codes: `0` success, `1` runtime error (API, invalid input, unparseable reference), `2` usage error.

## Environment variables

| Variable | Used for |
| --- | --- |
| `ANTHROPIC_API_KEY` | `bible-ai run` (required) |
| `BIBLE_AI_MODEL` | Model for `run` (default `claude-sonnet-5-5`; `--model` overrides) |
| `BIBLE_AI_CACHE_DIR` | Cache directory |

## Adding a harness

1. Define it with `defineHarness` in `src/harnesses/<id>.ts`: input and output schemas, method, guardrails, `gather`.
2. Register it in `src/harnesses/index.ts`.
3. Test it with the fake fetch in `test/helpers/fake-fetch.ts`.
4. Run `npm run skills` and commit the generated `skills/<id>/SKILL.md`.

## Roadmap

- MCP server over the same core and harnesses.
- Word study with `bsb-interlinear` and `stepbible-lexicon`.
- People, places and chronology with `theographic` and `history-globe`.
- Packaging and a build step.

## Development

```sh
npm run check    # typecheck + tests
npm run skills   # regenerate skills/*/SKILL.md
```

TypeScript runs directly on Node 24 (native type stripping): relative imports use `.ts` extensions and only erasable syntax is allowed.
