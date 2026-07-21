# Claude Visible System Instructions

Source: `inspect/claude-example.jsonl`

This file records the visible instruction and capability layers present in the sample. It is not guaranteed to include hidden platform prompts or model-internal policy.

## Mode And Permissions

The session starts with:

- `mode: "normal"`
- `permissionMode: "default"`

These are separate records rather than ordinary chat messages.

## Visible System Events

Visible `system` records include:

- local command metadata, such as `/model`
- local command stdout
- turn duration and message count
- away summaries used for continuation

## Deferred Tools

Tool availability is attached through `deferred_tools_delta`. The sample includes task orchestration tools, web tools, cron tools, plan/worktree controls, push notifications, and MCP-backed Google/IDE tools.

## Agent Listing

The sample includes an `agent_listing_delta` with named agents and tool scopes:

- `claude`
- `claude-code-guide`
- `Explore`
- `general-purpose`
- `Plan`
- `statusline-setup`

## Skill Listing

The sample includes `skill_listing` content for local skills. Selected skill instructions appear later as tool-result content after the agent reads the relevant skill.

## Continuation Records

The transcript contains:

- `last-prompt`
- `ai-title`
- `queue-operation`
- `away_summary`
- file-history snapshots and deltas

Together, these records let the harness resume a turn-based workflow with context about what was done, what remains, and which files changed.
