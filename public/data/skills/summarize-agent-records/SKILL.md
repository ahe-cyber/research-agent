---
name: summarize-agent-records
description: Summarize selected records into findings, evidence, assumptions, and open questions.
---

# Summarize Agent Records

Use this skill when the user asks for a concise summary of selected records or recent research outputs.

## Workflow

1. Group records by source, type, and research question.
2. Extract factual findings and cite the record or dataset each finding came from.
3. Separate assumptions from confirmed observations.
4. Identify conflicts, missing fields, stale data, and follow-up questions.
5. Return a short summary with findings, evidence, assumptions, and next queries.

## Rules

- Do not merge conflicting records without noting the conflict.
- Prefer source-specific field names when they clarify the evidence.
