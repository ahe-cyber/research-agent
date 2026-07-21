---
name: compare-map-layers
description: Compare visible map layers and identify overlaps, gaps, conflicts, and useful follow-up dataset queries.
---

# Compare Map Layers

Use this skill when the user asks how visible map layers relate to each other.

## Workflow

1. List the visible layers and their source datasets.
2. Identify the spatial relationship the user cares about: overlap, containment, nearest feature, missing coverage, or conflict.
3. Compare layer geometry and attributes at the current map context.
4. Summarize findings with layer names, relevant feature identifiers, and uncertainty.
5. Recommend follow-up dataset queries only when they are needed to resolve a concrete gap.

## Rules

- Keep geometry claims tied to the current map state or queried data.
- Distinguish visual overlap from confirmed data relationships.
