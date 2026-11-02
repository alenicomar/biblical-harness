# bible-ai-foundation

Foundation of a Protestant/Evangelical Bible-study ecosystem for AI: a typed core over the Free Use Bible API, a dual-face harness contract (agent skill + executable pipeline), doctrinal profiles, the first two harnesses, and a CLI. The MCP server is out of scope here; the design must let it be a thin adapter later.

## Specs

- **S1** — Purpose: "quiero comenzar un ecosistema de estudio bíblico (protestante/evangélico) para IA. Con harnesses para toda clase de análisis."
- **S2** — Data source: "Me gustaría aprovechar la API de `https://bible.helloao.org/docs/`" (quickstart: `https://bible.helloao.org/docs/guide/getting-started.html`).
- **S3** — Future MCP (not built now, design must enable it): "Más adelante, cuando estos harnesses estén listos, no veo de más hacer un MCP bíblico que consuma esa misma API."
- **S4** — Harness meaning, user answer: "Ambos (recomendado)" — option text: "Contrato único por análisis: se expone como skill/prompt para agentes y también ejecutable como pipeline."
- **S5** — Stack, user answer: "TypeScript (recomendado)".
- **S6** — First analyses, user answer: "Exégesis de pasaje, Temático / referencias cruzadas" — option texts: "Contexto literario, estructura, observaciones, comentarios clásicos, aplicación." and "Rastrear un tema o doctrina a través del canon con open-cross-ref."
- **S7** — Doctrinal stance, user answer: "Configurable" — option text: "Postura parametrizable por perfil (reformada, bautista, pentecostal, etc.), con plural como default."

## Tasks

- [x] **T1** — S2, S5 — inline — Scaffold (TS on Node 24, node:test, git) + Protestant 66-book catalog + reference parser (`src/core/books.ts`, `src/core/reference.ts`). Commit: a61c001
- [x] **T2** — S2, S3 — inline — API client with injectable fetch and permanent cache, API types, chapter flattening, passage extraction, cross-references (`src/core/*`). Commit: 837bbb1
- [x] **T3** — S4, S7 — inline — Harness contract, shared guardrails, doctrinal profiles (plural default), prompt builder, skill renderer, LLM provider interface + Anthropic adapter (`src/harness/*`). Commit: ed63d6d
- [x] **T4** — S6 — inline — `passage-exegesis` harness (`src/harnesses/passage-exegesis.ts`). Commit: PENDING
- [ ] **T5** — S6 — inline — `thematic-study` harness over open-cross-ref (`src/harnesses/thematic-study.ts`). Commit: —
- [ ] **T6** — S3, S4 — inline — CLI (`bible-ai`), generated `skills/*/SKILL.md`, README with architecture and MCP roadmap. Commit: —

## Log

- **L1** — User request (verbatim): "Hola, quiero comenzar un ecosistema de estudio bíblico (protestante/evangélico) para IA. Con harnesses para toda clase de análisis. Me gustaría aprovechar la API de `https://bible.helloao.org/docs/` (también te dejo el enlace directo al quickstart: `https://bible.helloao.org/docs/guide/getting-started.html`). Más adelante, cuando estos harnesses estén listos, no veo de más hacer un MCP bíblico que consuma esa misma API."
- **L2** — User answers: harness = "Ambos (recomendado)"; stack = "TypeScript (recomendado)"; first = "Exégesis de pasaje, Temático / referencias cruzadas"; stance = "Configurable".
- **L3** — Evidence (API exploration): 1504 translations; Spanish public-domain-ish set includes `spa_r09` (RV1909), `spa_rvg`, `spa_v2p`, `spa_blm`; RVR1960 is NOT available. Originals: `grc_sbl`, `grc_gtr`, `grc_byz`, `hbo_wlc`. Commentaries are English only: matthew-henry, john-calvin, john-gill, keil-delitzsch (OT), jamieson-fausset-brown, adam-clarke, tyndale. Datasets: bsb-interlinear, stepbible-lexicon, open-cross-ref, theographic, history-globe, verse-of-the-day. No full-text search endpoint, so thematic study needs seed references. Caching/storing is explicitly allowed.
- **L4** — Decisions: single package with module boundaries (`core`, `harness`, `harnesses`, `cli`; `mcp` later). Code, prompts and docs in English; analysis output language is an input defaulting to Spanish (`es`). Default translation `spa_r09`. Runtime dep: `zod` only (schemas reusable by the future MCP SDK). Pipeline LLM provider behind an interface; Anthropic adapter via fetch; `prompt`/dry-run works without any key.
- **L5** — Evidence (T4 live smoke): section-based commentaries (Matthew Henry, Tyndale "3:16-21") key a note to the section's first verse, so Jn 3:16-17 returned 0 Henry notes. Fix: `getCommentary` includes the closest earlier note covering the passage's first verse (pinned in `test/core/passage.test.ts`).
