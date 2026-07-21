# Codex Visible System Instructions

Source: `inspect/codex-example.jsonl`

This file records the visible instruction layers present in the sample. It is not guaranteed to include hidden platform prompts or model-internal policy.

## Base Instructions

The transcript exposes `session_meta.payload.base_instructions.text`. Major sections:

- Role: Codex is a coding agent sharing one workspace with the user.
- Work style: inspect the codebase first, prefer repo conventions, keep changes scoped, validate with tests/builds when appropriate.
- Frontend guidance: build real usable app surfaces, use existing design systems, avoid decorative layouts for operational tools, verify responsive behavior.
- Editing constraints: preserve user changes, avoid destructive git operations, use patch-based manual edits, keep comments succinct.
- Collaboration: give short progress updates, continue through implementation and verification, answer newest user request after interruptions.
- Final answer style: concise, mention verification and any failures.

## Developer / Runtime Instructions

The sample injects developer messages with:

- filesystem sandbox and approval policy
- collaboration mode
- apps/connectors handling
- plugin handling
- skill routing and progressive disclosure
- approved command prefixes

## Turn Context Fields

Each `turn_context` includes:

- cwd and workspace roots
- current date and timezone
- sandbox policy and permission profile
- model and effort settings
- collaboration mode settings
- multi-agent version
- whether realtime is active
- summary mode

## Persistence And Compaction

Later records include `compacted` and `world_state`. These are the visible mechanism for continuing after the context grows: prior chat/tool history is replaced by a summary plus current environment state.
