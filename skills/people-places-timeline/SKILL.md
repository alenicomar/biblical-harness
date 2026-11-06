---
name: people-places-timeline
description: Use when studying the people, places and events of a passage, or one biblical person, place or event: who they are, where (with coordinates), when (timeline) and how they relate, from Theographic and History Globe.
---

# People, places and timeline

<!-- Generated from src/harnesses/people-places-timeline.ts by `biblical-harness skills build`. Do not edit by hand. -->

## 1. Gather the evidence

Run the CLI and read its JSON output. Do not answer from memory: every quotation and reference must come from this evidence.

```sh
biblical-harness gather people-places-timeline --input '<json>' [--profile <id>] [--lang <code>]
```

Input (JSON Schema):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "reference": {
      "type": "string",
      "description": "Passage mode: the passage whose people, places and events to study, e.g. \"Hch 16:1-15\"."
    },
    "entity": {
      "description": "Entity mode: one biblical person, place, event or group to study across the Bible.",
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "enum": [
            "person",
            "place",
            "event",
            "group"
          ],
          "description": "What the name designates."
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "description": "Name of the person, place, event or group, e.g. \"David\", \"Bethlehem\", \"Philippi\", \"The Exodus\". Theographic spells names in English; common Spanish names (Belén, Pedro, Pablo…) are translated automatically, other Spanish names must be given in English. Accents and case are ignored."
        }
      },
      "required": [
        "kind",
        "name"
      ]
    },
    "translation": {
      "default": "spa_r09",
      "description": "API translation id, e.g. \"spa_r09\" (Reina-Valera 1909), \"BSB\".",
      "type": "string"
    },
    "maxEntities": {
      "default": 20,
      "description": "Passage mode: entities enriched per kind, most mentioned in the passage first. Entity mode: related events kept.",
      "type": "integer",
      "minimum": 1,
      "maximum": 50
    },
    "maxReferences": {
      "default": 10,
      "description": "Entity mode: verse texts fetched for the entity (first references in canonical order). Passage mode only fetches the passage text.",
      "type": "integer",
      "minimum": 0,
      "maximum": 50
    },
    "descriptionCharLimit": {
      "default": 1500,
      "description": "Maximum characters kept per dictionary description (Easton's, 1897).",
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    }
  }
}
```

## 2. Follow the method

1. Read the passage (or the entity’s key references) in context before using any background data.
2. Identify each person, place and event; distinguish namesakes using ids and references, never merging them.
3. Place the events on the timeline, stating the dating basis (the dataset’s single chronology) and how uncertain it is.
4. Locate the places with their coordinates and explain how the geography (distances, routes, terrain) shapes the narrative.
5. Trace the relations: family, group membership, participants of each event.
6. Connect the people, places and events to the wider biblical storyline.
7. State the uncertainties: contested dates, doubtful identifications, coordinates that disagree between datasets.
8. Draw applications from the text itself, not from the background alone.

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
- Dates are approximate reconstructions from one chronology (Theographic). Present them as approximate and note that scholars differ (e.g. early vs late Exodus).
- Place identifications and coordinates can be uncertain; say so, especially when Theographic and History Globe disagree.
- Dictionary descriptions come from Easton’s Bible Dictionary (1897) and are secondary sources: attribute them and prefer the biblical text.
- Do not merge different people (or places) who share a name; use the ids and references to tell them apart.
- Background illuminates the text; it does not replace it.

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
    "summary": {
      "type": "string",
      "description": "Who, where and when in two or three sentences, as far as the evidence shows."
    },
    "people": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "identification": {
            "type": "string",
            "description": "Who this is, distinguished from namesakes by id or references."
          },
          "role": {
            "type": "string",
            "description": "Role in the passage, or in the biblical story for entity mode."
          },
          "relations": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Family, group membership and co-participants, e.g. \"son of Jesse\"."
          },
          "dates": {
            "description": "Approximate life dates from the evidence, hedged.",
            "type": "string"
          },
          "references": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "name",
          "identification",
          "role",
          "relations",
          "references"
        ],
        "additionalProperties": false
      }
    },
    "places": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "description": "City, region, water, landmark, etc."
          },
          "coordinates": {
            "type": "object",
            "properties": {
              "latitude": {
                "type": "number"
              },
              "longitude": {
                "type": "number"
              }
            },
            "required": [
              "latitude",
              "longitude"
            ],
            "additionalProperties": false
          },
          "identificationConfidence": {
            "type": "string",
            "enum": [
              "high",
              "medium",
              "low"
            ],
            "description": "How secure the identification and its coordinates are."
          },
          "significance": {
            "type": "string",
            "description": "What happens here and why it matters for the text."
          },
          "references": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "name",
          "type",
          "identificationConfidence",
          "significance",
          "references"
        ],
        "additionalProperties": false
      }
    },
    "timeline": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "description": "Approximate date, e.g. \"c. 46-48 d.C.\", or \"undated\"."
          },
          "event": {
            "type": "string"
          },
          "references": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "dateConfidence": {
            "type": "string",
            "enum": [
              "high",
              "medium",
              "low"
            ],
            "description": "How firm the dating is; the dataset follows a single chronology."
          }
        },
        "required": [
          "date",
          "event",
          "references",
          "dateConfidence"
        ],
        "additionalProperties": false
      }
    },
    "historicalContext": {
      "type": "string",
      "description": "Political, social and religious setting; flag background not in the evidence."
    },
    "geographyNotes": {
      "type": "string",
      "description": "How the geography (distances, routes, terrain) shapes the narrative."
    },
    "disambiguation": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "People or places sharing a name, as the evidence shows, and how to tell them apart."
    },
    "uncertainties": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Dates, identifications or coordinates the evidence leaves open."
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
    "summary",
    "people",
    "places",
    "timeline",
    "historicalContext",
    "geographyNotes",
    "disambiguation",
    "uncertainties",
    "application",
    "sources"
  ],
  "additionalProperties": false
}
```
