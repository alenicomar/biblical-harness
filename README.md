# biblical-harness

A Protestant/Evangelical Bible-study ecosystem for AI. Each analysis is a **harness**: defined once, usable by an agent as a skill and runnable as a pipeline. The data comes from the [Free Use Bible API](https://bible.helloao.org/docs/).

## Architecture

| Layer | Path | Role |
| --- | --- | --- |
| Core | `src/core` | Typed, cached API client; reference parser (`Jn 3:16-18`, `1 Co 13`); passage, commentary and cross-reference helpers |
| Harness | `src/harness` | The dual-face contract, shared guardrails, doctrinal profiles, prompt and skill renderers, LLM provider |
| Harnesses | `src/harnesses` | The analyses themselves, registered in `src/harnesses/index.ts` |
| CLI | `src/cli` | `biblical-harness`: the way agents and people reach everything above |
| Build | `dist`, `scripts` | Compiled JS the installed command runs (committed); `postinstall` that sets up the user install |
| MCP (future) | `src/mcp` | A thin adapter, no new logic: core → MCP tools/resources, harnesses → MCP prompts |

Dependencies point one way: `cli` (and later `mcp`) → `harnesses` → `harness` → `core`.

## Harnesses

| Id | Use it to |
| --- | --- |
| `passage-exegesis` | Study a passage: literary context, structure, original text, classic commentaries, cross references, application |
| `thematic-study` | Trace a theme or doctrine through the canon from seed passages, via cross references |
| `word-study` | Study a Hebrew or Greek word of a passage (or a Strong's number): lexicon, semantic range, occurrences, renderings |
| `people-places-timeline` | Study the people, places and events of a passage, or one person, place, event or group: relations, coordinates, timeline |

`biblical-harness harnesses` lists them.

## Two faces, one contract

- **Skill**: `skills/<id>/SKILL.md`, generated from the harness. An agent reads it, runs `biblical-harness gather <id> --input '<json>'` to collect evidence, and writes the report itself.
- **Pipeline**: `biblical-harness run <id> --input '<json>'` gathers the same evidence, asks a model (Anthropic), and validates the JSON report against the harness schema. `biblical-harness prompt` shows the prompt without calling any model.

Both faces share the same input schema, evidence gathering and guardrails. Skills are never edited by hand: run `npm run skills`. A test fails when they drift from the harness definitions.

`npm install` puts the skills in `~/.agents/skills`. For an agent that reads skills elsewhere, copy them there with `biblical-harness skills install --dir <dir>`.

## Doctrinal profiles

Pass `--profile <id>` (default `plural`). All profiles share the core evangelical convictions and differ on secondary matters. `biblical-harness profiles show <id>` prints the details.

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

- Default translation: `spa_r09` (Reina-Valera 1909). RVR1960 is not available in the API. Other texts: `biblical-harness translations --lang spa`.
- Commentaries are in English (`biblical-harness commentaries`). Reports are still written in the requested language (`--lang`, default `es`).
- The API has no full-text search, so a thematic study needs seed passages you choose.
- `word-study` counts occurrences by scanning interlinear chapters: a book is quick, a whole testament fetches hundreds of chapters on the first run (about 90 s for the OT), then it is cached. Lexicon definitions are in English.
- `people-places-timeline` looks names up in English, as Theographic spells them (`Bethlehem`, `Peter`). Its dates follow one chronology and are approximate, and its descriptions come from Easton's Bible Dictionary (1897).
- Responses are immutable, so they are cached forever in `$BIBLICAL_HARNESS_CACHE_DIR`, else `$XDG_CACHE_HOME/biblical-harness`, else `~/.cache/biblical-harness`. Use `--no-cache` to skip the disk.
- Each text and dataset keeps its own license; check it before redistributing.

## Quick start

Requires Node ≥ 24.

### Install

```sh
git clone https://github.com/alenicomar/biblical-harness.git
cd biblical-harness
npm install
```

`npm install` also installs the clone for your user, without root:

- links the `biblical-harness` command into `~/.local/bin` (it tells you if that directory is not on your `PATH`);
- installs the skills into `~/.agents/skills`.

The command runs from the clone, so `git pull` updates it. Redo this step with `npm run setup`, undo it with `npm run teardown`, or skip it with `BIBLICAL_HARNESS_SKIP_SETUP=1 npm install`. It never runs when the package is installed as a dependency, globally, or in CI.

### Use it

```sh
biblical-harness passage "Jn 3:16-18"
biblical-harness xref "Ro 8:28" --limit 3
biblical-harness gather passage-exegesis --input '{"reference":"Ro 8:28-39"}'
biblical-harness prompt thematic-study --input '{"theme":"justificación por la fe","seeds":["Ro 3:21-26","Gá 2:16"]}' --profile reformed
biblical-harness gather word-study --input '{"reference":"Jn 3:16","word":"loved"}'
biblical-harness gather people-places-timeline --input '{"reference":"Hch 16:1-15"}'
biblical-harness gather people-places-timeline --input '{"entity":{"kind":"place","name":"Bethlehem"}}'
ANTHROPIC_API_KEY=... biblical-harness run passage-exegesis --input @exegesis.json --profile baptist
```

`--input` takes JSON or `@file.json`. Every command has `--help`. Exit codes: `0` success, `1` runtime error (API, invalid input, unparseable reference), `2` usage error.

## Environment variables

| Variable | Used for |
| --- | --- |
| `ANTHROPIC_API_KEY` | `biblical-harness run` (required) |
| `BIBLICAL_HARNESS_MODEL` | Model for `run` (default `claude-sonnet-5-5`; `--model` overrides) |
| `BIBLICAL_HARNESS_CACHE_DIR` | Cache directory |
| `BIBLICAL_HARNESS_BIN_DIR` | Where `npm install` / `npm run setup` links the command (default `~/.local/bin`) |
| `BIBLICAL_HARNESS_SKILLS_DIR` | Where they install the skills (default `~/.agents/skills`) |
| `BIBLICAL_HARNESS_SKIP_SETUP` | Set to skip the user install during `npm install` |

## Adding a harness

1. Define it with `defineHarness` in `src/harnesses/<id>.ts`: input and output schemas, method, guardrails, `gather`.
2. Register it in `src/harnesses/index.ts`.
3. Test it with the fake fetch in `test/helpers/fake-fetch.ts`.
4. Run `npm run skills` and `npm run build`, and commit the generated `skills/<id>/SKILL.md` and `dist/`.

## Roadmap

- MCP server over the same core and harnesses.
- Spanish names for `people-places-timeline` lookups.

## Development

```sh
npm run check    # typecheck + tests
npm run skills   # regenerate skills/*/SKILL.md
npm run build    # compile src/ to dist/ (committed: the installed CLI runs dist/cli/main.js; a test catches drift)
node src/cli/main.ts <command>   # run from source without building
```

TypeScript runs directly on Node 24 (native type stripping): relative imports use `.ts` extensions and only erasable syntax is allowed.
