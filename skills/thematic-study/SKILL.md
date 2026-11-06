---
name: thematic-study
description: "Use when tracing a theme or doctrine across the canon from seed passages via cross references: how it is introduced, developed and fulfilled from Law to Apocalypse, with Christ at the centre."
---

# Thematic study

<!-- Generated from src/harnesses/thematic-study.ts by `biblical-harness skills build`. Do not edit by hand. -->

## 1. Gather the evidence

Run the CLI and read its JSON output. Do not answer from memory: every quotation and reference must come from this evidence.

```sh
biblical-harness gather thematic-study --input '<json>' [--profile <id>] [--lang <code>]
```

Input (JSON Schema):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "theme": {
      "type": "string",
      "minLength": 2,
      "description": "Theme or doctrine to trace, e.g. \"justificación por la fe\", \"el pacto\", \"el Espíritu Santo\"."
    },
    "seeds": {
      "minItems": 1,
      "maxItems": 10,
      "type": "array",
      "items": {
        "type": "string",
        "description": "Seed passage that states or illustrates the theme, e.g. \"Ro 3:21-28\"."
      },
      "description": "Passages the study starts from. The API has no full-text search, so the theme is traced by following cross references from these."
    },
    "translation": {
      "default": "spa_r09",
      "description": "API translation id, e.g. \"spa_r09\" (Reina-Valera 1909), \"BSB\".",
      "type": "string"
    },
    "depth": {
      "default": 1,
      "description": "1 follows cross references from the seeds; 2 also follows them from the depth-1 targets.",
      "type": "integer",
      "minimum": 1,
      "maximum": 2
    },
    "crossReferencesPerVerse": {
      "default": 5,
      "type": "integer",
      "minimum": 1,
      "maximum": 20
    },
    "minCrossReferenceScore": {
      "default": 10,
      "description": "Minimum OpenBible vote score for a cross reference.",
      "type": "number"
    },
    "maxPassages": {
      "default": 30,
      "description": "Maximum linked passages kept, highest aggregate score first.",
      "type": "integer",
      "minimum": 1,
      "maximum": 80
    }
  },
  "required": [
    "theme",
    "seeds"
  ]
}
```

## 2. Follow the method

1. Define the theme from the seed passages, reading each in its own context before drawing on it.
2. Trace the theme through the canon section by section, in canonical order, using the linked passages.
3. For each linked passage judge whether the link is explicit (same words or a quotation), conceptual, or weak; discard weak links explicitly instead of silently.
4. Observe progressive revelation: how later texts develop, qualify or fulfil earlier ones.
5. Show the fulfilment of the theme in Christ where the texts warrant it.
6. Identify disputed points and handle them according to the doctrinal profile.
7. Synthesize the biblical theology of the theme from the passages kept.
8. Draw applications, each as a principle with a concrete practice.
9. Report the gaps: aspects of the theme the evidence leaves uncovered.

## 3. Respect the guardrails

Shared convictions:

- Scripture, Old and New Testament, is the inspired Word of God and the final authority for faith and practice (sola Scriptura).
- One God eternally existing in three persons: Father, Son and Holy Spirit.
- Jesus Christ is fully God and fully man; he died for sinners and rose bodily from the dead.
- Salvation is by grace alone, through faith alone, in Christ alone.
- The new birth by the Holy Spirit and the call to holiness, mission and the life of the church.

Rules:

- Ground every claim in the gathered evidence and cite it by reference (book chapter:verse).
- Quote Scripture only from the gathered text, word for word, naming the translation; never invent or reconstruct a quotation.
- Keep observation (what the text says), interpretation (what it means) and application (what it calls for) separate.
- Attribute commentary views to their author (for example "Matthew Henry"); never present a commentator as the text itself.
- Make original-language claims (Hebrew, Aramaic, Greek) only when the evidence includes the original text or lexical data; otherwise mark them as unverified.
- Read in context (literary, historical and canonical) and let clearer passages illuminate harder ones.
- Present doctrinal conclusions as positions held by a tradition, following the active doctrinal profile.
- State uncertainty honestly and give a confidence level for interpretive conclusions.
- Cross references come from crowd-sourced OpenBible votes: they are a starting point, not proof. Judge each link yourself.
- Never claim the evidence is exhaustive: the API has no full-text search, so the passages depend on the seeds and the cross-reference dataset.
- Avoid proof-texting: read each passage in its own context before using it for the theme.

## 4. Apply the doctrinal profile

Use the profile the user asks for; otherwise `plural`. Print its instructions with `biblical-harness profiles show <id>`.

- `plural` (default): Evangelical plural (Evangélico plural). Presents the main Protestant readings of disputed points side by side, without taking sides.
- `reformed`: Reformed / Presbyterian (Reformada / Presbiteriana). Reads Scripture within the Reformed confessions and covenant theology.
- `baptist`: Baptist (Bautista). Reads Scripture within Baptist convictions on the church and the ordinances.
- `lutheran`: Lutheran (Luterana). Reads Scripture within the Lutheran confessions and the law–gospel distinction.
- `wesleyan-arminian`: Wesleyan / Arminian (Wesleyana / Arminiana). Reads Scripture within Wesleyan-Arminian theology of grace and holiness.
- `pentecostal`: Pentecostal / Charismatic (Pentecostal / Carismática). Reads Scripture with a continuationist view of the gifts of the Spirit.
- `dispensational`: Dispensational (Dispensacionalista). Reads Scripture with a dispensational framework and a consistent literal hermeneutic.

## 5. Write the report

Write in the user's language, as a Markdown report whose sections follow this structure (the pipeline face returns it as JSON):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "theme": {
      "type": "string"
    },
    "definition": {
      "type": "string",
      "description": "The theme as the seed passages define it, in two or three sentences."
    },
    "canonicalProgression": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "section": {
            "type": "string",
            "description": "Canonical section, e.g. \"Law\", \"Wisdom & Poetry\", \"Gospels\"."
          },
          "passages": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "References from that section that carry explicit or conceptual links."
          },
          "contribution": {
            "type": "string",
            "description": "What this section adds to the theme and how it develops earlier revelation."
          }
        },
        "required": [
          "section",
          "passages",
          "contribution"
        ],
        "additionalProperties": false
      },
      "description": "Sections in canonical order; omit sections without usable passages."
    },
    "keyPassages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "reference": {
            "type": "string"
          },
          "role": {
            "type": "string",
            "description": "Why the passage is pivotal for the theme."
          }
        },
        "required": [
          "reference",
          "role"
        ],
        "additionalProperties": false
      }
    },
    "synthesis": {
      "type": "string",
      "description": "The biblical theology of the theme across the canon."
    },
    "christologicalFocus": {
      "type": "string",
      "description": "How the theme finds fulfilment in Christ, only as far as the texts warrant."
    },
    "disputedPoints": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "question": {
            "type": "string"
          },
          "positions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "tradition": {
                  "type": "string",
                  "description": "Tradition holding the view, e.g. \"Reformed\", \"Arminian\"."
                },
                "view": {
                  "type": "string"
                },
                "support": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "References supporting the view."
                }
              },
              "required": [
                "tradition",
                "view",
                "support"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "question",
          "positions"
        ],
        "additionalProperties": false
      }
    },
    "application": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "principle": {
            "type": "string",
            "description": "Timeless truth drawn from the interpretation."
          },
          "practice": {
            "type": "string",
            "description": "Concrete response for the church or the believer today."
          }
        },
        "required": [
          "principle",
          "practice"
        ],
        "additionalProperties": false
      }
    },
    "gaps": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Aspects of the theme the evidence does not cover."
    },
    "sources": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Translations and datasets used."
    }
  },
  "required": [
    "theme",
    "definition",
    "canonicalProgression",
    "keyPassages",
    "synthesis",
    "christologicalFocus",
    "disputedPoints",
    "application",
    "gaps",
    "sources"
  ],
  "additionalProperties": false
}
```
