---
name: word-study
description: Use when studying a Hebrew or Greek word of a passage (or a Strong's number): its lexical meaning, semantic range, usage across the book or testament and how translations render it, avoiding word-study fallacies.
---

# Word study

<!-- Generated from src/harnesses/word-study.ts by `biblical-harness skills build`. Do not edit by hand. -->

## 1. Gather the evidence

Run the CLI and read its JSON output. Do not answer from memory: every quotation and reference must come from this evidence.

```sh
biblical-harness gather word-study --input '<json>' [--profile <id>] [--lang <code>]
```

Input (JSON Schema):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "reference": {
      "type": "string",
      "description": "Passage that contains the word, e.g. \"Jn 3:16\", \"Ro 3:21-26\"."
    },
    "word": {
      "description": "Word to study, matched (ignoring case and diacritics) against the interlinear gloss, transliteration or original text within the passage, e.g. \"loved\", \"agapaō\", \"ἠγάπησεν\".",
      "type": "string",
      "minLength": 1
    },
    "strongs": {
      "description": "Strong's number to study instead of a word, e.g. \"G25\" or \"H2617\".",
      "type": "string"
    },
    "translation": {
      "default": "spa_r09",
      "description": "API translation id, e.g. \"spa_r09\" (Reina-Valera 1909), \"BSB\".",
      "type": "string"
    },
    "scope": {
      "description": "Where to count the word: only the passage, the whole book of the reference, or the whole testament of the word. Default: \"book\" with a reference, else \"testament\".",
      "type": "string",
      "enum": [
        "passage",
        "book",
        "testament"
      ]
    },
    "maxOccurrences": {
      "default": 30,
      "description": "Maximum sample occurrences kept per word, in canonical order.",
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "definitionCharLimit": {
      "default": 3000,
      "description": "Maximum characters kept per lexicon definition.",
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    }
  }
}
```

## 2. Follow the method

1. Read the passage and identify the word in the interlinear: its original form, parsing and gloss.
2. Read the lexicon entry and list the senses it gives, without treating them as all present at once.
3. Survey the sampled occurrences and group them by sense, noting the references for each.
4. Decide the sense in this passage from its immediate context, not from etymology or from the lexicon’s first entry.
5. Compare how the translation renders the word across the occurrences, using the gloss counts.
6. Note related words only as far as the lexicon or the interlinear shows them.
7. Draw the theological significance and application from the passage’s own use of the word.
8. State the limits of the evidence: what was scanned and what was not.

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
- Context determines meaning: never assume a word carries the same sense everywhere.
- Avoid the root fallacy and etymologizing: a word’s history does not fix its meaning in a given text.
- Avoid illegitimate totality transfer: do not load every sense of the word into one occurrence.
- Avoid anachronism: do not read later meanings back, e.g. "dynamite" for dynamis.
- Do not overload grammar: the aorist, for example, is not "once for all" by itself.
- Strong’s numbers group lemmas, not senses; the same number can cover distinct uses.
- Counts cover only the scanned scope (passage, book or testament): never claim exhaustiveness beyond it.

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
    "word": {
      "type": "string",
      "description": "The lemma with its transliteration, e.g. \"ἀγαπάω (agapaō)\"."
    },
    "strongs": {
      "type": "string"
    },
    "language": {
      "type": "string",
      "description": "\"Greek\", \"Hebrew\" or \"Aramaic\"."
    },
    "partOfSpeech": {
      "type": "string"
    },
    "lexicalMeaning": {
      "type": "string",
      "description": "What the lexicon says the word means, in two or three sentences."
    },
    "semanticRange": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "sense": {
            "type": "string"
          },
          "references": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Sampled references where this sense fits."
          }
        },
        "required": [
          "sense",
          "references"
        ],
        "additionalProperties": false
      },
      "description": "Senses of the word grouped from the lexicon and the sampled occurrences."
    },
    "usageInPassage": {
      "type": "string",
      "description": "What the word means in this passage, decided from its immediate context, with its form and parsing."
    },
    "distribution": {
      "type": "string",
      "description": "Where and how often the word occurs, from the counts of the scanned scope only."
    },
    "translationRenderings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rendering": {
            "type": "string",
            "description": "English rendering used by the BSB."
          },
          "count": {
            "type": "number"
          },
          "note": {
            "type": "string",
            "description": "When this rendering is used or what it emphasises."
          }
        },
        "required": [
          "rendering",
          "note"
        ],
        "additionalProperties": false
      }
    },
    "relatedWords": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "strongs": {
            "type": "string"
          },
          "word": {
            "type": "string"
          },
          "relation": {
            "type": "string",
            "description": "How it relates, as the lexicon or the interlinear shows."
          }
        },
        "required": [
          "word",
          "relation"
        ],
        "additionalProperties": false
      }
    },
    "theologicalSignificance": {
      "type": "string",
      "description": "What the word contributes to the passage’s teaching, without loading it with every sense."
    },
    "fallaciesAvoided": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Word-study fallacies the analysis took care to avoid, and where."
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
      "description": "Translations and datasets used."
    }
  },
  "required": [
    "word",
    "strongs",
    "language",
    "partOfSpeech",
    "lexicalMeaning",
    "semanticRange",
    "usageInPassage",
    "distribution",
    "translationRenderings",
    "relatedWords",
    "theologicalSignificance",
    "fallaciesAvoided",
    "application",
    "sources"
  ],
  "additionalProperties": false
}
```
