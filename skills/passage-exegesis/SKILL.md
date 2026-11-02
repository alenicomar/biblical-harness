---
name: passage-exegesis
description: Use when studying a specific Bible passage in depth: literary and historical context, structure, observations, key terms, classical commentaries, cross references and application, following the grammatical-historical method.
---

# Passage exegesis

<!-- Generated from src/harnesses/passage-exegesis.ts by `bible-ai skills build`. Do not edit by hand. -->

## 1. Gather the evidence

Run the CLI and read its JSON output. Do not answer from memory: every quotation and reference must come from this evidence.

```sh
bible-ai gather passage-exegesis --input '<json>' [--profile <id>] [--lang <code>]
```

Input (JSON Schema):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "reference": {
      "type": "string",
      "description": "Passage to study, e.g. \"Jn 3:1-21\", \"Ro 8:28-39\", \"Sal 23\"."
    },
    "translation": {
      "default": "spa_r09",
      "description": "API translation id, e.g. \"spa_r09\" (Reina-Valera 1909), \"BSB\".",
      "type": "string"
    },
    "compare": {
      "default": [],
      "description": "Extra translation ids to compare, e.g. [\"BSB\", \"spa_rvg\"].",
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "original": {
      "default": true,
      "description": "Include the Greek (SBL) or Hebrew (WLC) text.",
      "type": "boolean"
    },
    "contextVerses": {
      "default": 5,
      "description": "Verses of surrounding context on each side.",
      "type": "integer",
      "minimum": 0,
      "maximum": 30
    },
    "commentaries": {
      "description": "Commentary ids. Default: Keil-Delitzsch, Matthew Henry, Tyndale (OT); Matthew Henry, JFB, Tyndale (NT).",
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "matthew-henry",
          "john-calvin",
          "john-gill",
          "keil-delitzsch",
          "jamieson-fausset-brown",
          "adam-clarke",
          "tyndale"
        ]
      }
    },
    "commentaryCharLimit": {
      "default": 4000,
      "description": "Maximum characters kept per commentary note.",
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    },
    "crossReferencesPerVerse": {
      "default": 5,
      "type": "integer",
      "minimum": 0,
      "maximum": 20
    },
    "maxCrossReferences": {
      "default": 15,
      "type": "integer",
      "minimum": 0,
      "maximum": 60
    },
    "minCrossReferenceScore": {
      "default": 5,
      "description": "Minimum OpenBible vote score for a cross reference.",
      "type": "number"
    }
  },
  "required": [
    "reference"
  ]
}
```

## 2. Follow the method

1. Read the passage in the main translation, then its surrounding context and section headings; identify the genre and where the passage sits in the book’s argument.
2. Compare the other translations and the original text when given; note meaningful differences and the key terms.
3. Outline the structure: units, movements and the connectors that join them.
4. Record observations verse by verse: people, actions, setting, repetitions, contrasts, commands, promises.
5. Describe the historical and cultural setting only as far as the evidence and well-established background allow, flagging background not in the evidence.
6. Interpret the author’s intended meaning for the original audience, with supporting references and a confidence level for each point.
7. Read the classical commentaries: summarize their insights, attribute each one, and note where they agree or disagree.
8. Follow the cross references to see how the rest of Scripture illuminates the passage, including its fulfilment in Christ where the text or the New Testament warrants it.
9. Identify disputed points and handle them according to the doctrinal profile.
10. Draw theological themes and applications that flow from the interpretation, each as a principle with a concrete practice.

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
- Do not take a commentator’s devotional application as the meaning of the passage.
- Ground Christ-centred readings in the text or in explicit New Testament use; do not impose them.
- Every application must follow from an interpretation point stated in the report.

## 4. Apply the doctrinal profile

Use the profile the user asks for; otherwise `plural`. Print its instructions with `bible-ai profiles show <id>`.

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
    "reference": {
      "type": "string"
    },
    "translation": {
      "type": "string"
    },
    "summary": {
      "type": "string",
      "description": "The passage’s main point in two or three sentences."
    },
    "literaryContext": {
      "type": "string",
      "description": "Genre and place in the book’s flow."
    },
    "historicalContext": {
      "type": "string",
      "description": "Setting for the original audience; flag background not in the evidence."
    },
    "structure": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "verses": {
            "type": "string",
            "description": "Verse range inside the passage, e.g. \"16-17\"."
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          }
        },
        "required": [
          "verses",
          "title",
          "description"
        ],
        "additionalProperties": false
      }
    },
    "observations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "verses": {
            "type": "string",
            "description": "Verse range inside the passage, e.g. \"16-17\"."
          },
          "observation": {
            "type": "string"
          }
        },
        "required": [
          "verses",
          "observation"
        ],
        "additionalProperties": false
      }
    },
    "keyTerms": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "term": {
            "type": "string"
          },
          "original": {
            "description": "Original-language word, only if present in the evidence.",
            "type": "string"
          },
          "meaning": {
            "type": "string"
          },
          "verses": {
            "type": "string",
            "description": "Verse range inside the passage, e.g. \"16-17\"."
          }
        },
        "required": [
          "term",
          "meaning",
          "verses"
        ],
        "additionalProperties": false
      }
    },
    "interpretation": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "point": {
            "type": "string"
          },
          "support": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "confidence": {
            "type": "string",
            "enum": [
              "high",
              "medium",
              "low"
            ]
          }
        },
        "required": [
          "point",
          "support",
          "confidence"
        ],
        "additionalProperties": false
      }
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
    "commentaryInsights": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "commentator": {
            "type": "string"
          },
          "verses": {
            "type": "string",
            "description": "Verse range inside the passage, e.g. \"16-17\"."
          },
          "insight": {
            "type": "string"
          }
        },
        "required": [
          "commentator",
          "verses",
          "insight"
        ],
        "additionalProperties": false
      }
    },
    "crossReferences": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "reference": {
            "type": "string"
          },
          "connection": {
            "type": "string"
          }
        },
        "required": [
          "reference",
          "connection"
        ],
        "additionalProperties": false
      }
    },
    "theologicalThemes": {
      "type": "array",
      "items": {
        "type": "string"
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
    "sources": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Translations, commentaries and datasets used."
    }
  },
  "required": [
    "reference",
    "translation",
    "summary",
    "literaryContext",
    "historicalContext",
    "structure",
    "observations",
    "keyTerms",
    "interpretation",
    "disputedPoints",
    "commentaryInsights",
    "crossReferences",
    "theologicalThemes",
    "application",
    "sources"
  ],
  "additionalProperties": false
}
```
