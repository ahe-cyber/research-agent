---
name: query-selected-datasets
description: Query the selected datasets in an order where each query can use parameters or identifiers returned by earlier queries.
---

# Query Selected Datasets

Use this skill when the user asks the agent to query selected datasets, especially when one dataset provides parameters for another query.

## Workflow

1. List the selected datasets and identify each dataset's available query parameters.
2. Build a dependency order. Query datasets with explicit user-provided parameters first.
3. For each query, extract reusable outputs such as identifiers, coordinates, BBL, BIN, names, dates, or geometry.
4. Use previous outputs to fill later query parameters when the later dataset requires them.
5. Return a compact result table with dataset name, query parameters, record count, key fields, and source assumptions.

## Rules

- Do not invent missing query parameters.
- If multiple previous outputs could fill a parameter, explain the choice.
- If a dataset cannot be queried because a required parameter is unavailable, skip it and report the blocker.
