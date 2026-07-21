# Claude Turn Workflow Notes

Source: `inspect/claude-example.jsonl`

## Transcript Shape

The Claude sample is append-only JSONL. Top-level records include:

- `mode`: current interaction mode.
- `permission-mode`: current permission profile.
- `system`: local command events, turn durations, and away summaries.
- `attachment`: deferred tools, agent listings, skill listings, and tool results.
- `user`: user prompts and tool-result messages.
- `assistant`: assistant messages, including thinking/signature payloads.
- `last-prompt`: prompt summary for the active session.
- `ai-title`: generated session title.
- `queue-operation`: queued user operations such as `/compact`.
- `file-history-snapshot` and `file-history-delta`: tracked file backup state.

## Agentic Continuation

Claude continues through explicit session ids, parent UUID chains, away summaries, prompt summaries, file-history snapshots, and queued operations. The transcript includes `away_summary` events that describe what was completed and what to do next.

## Skills

The sample includes an `attachment` with `type: "skill_listing"` and separate tool-result content for selected skill files. Skills are exposed as runtime attachments and then read when invoked.

Live Claude or editor skill directories are intentionally not linked into this project. The research-agent skill feature is project-specific and uses `public/data/skills/<skill-name>/SKILL.md` instead.

## Tools And MCP

The sample exposes tool availability through `deferred_tools_delta` attachments. It includes first-party tools such as `TaskCreate`, `TaskGet`, `TaskList`, `TaskOutput`, `TaskStop`, `TaskUpdate`, `SendMessage`, web tools, cron tools, plan/worktree controls, and MCP tools such as Gmail, Google Calendar, Google Drive, and IDE diagnostics.

## System Instructions

The sample does not expose one full hidden system prompt. The visible system-like records are local command events, permission/mode records, turn duration records, and away summaries. Tool, agent, and skill capabilities are attached separately.

See `claude-visible-system-instructions.md` for a compact extraction of the visible instruction/capability layers.

## Agent Orchestration

Claude exposes orchestration explicitly through agent listing attachments and task tools. The sample lists agents such as `claude`, `claude-code-guide`, `Explore`, `general-purpose`, `Plan`, and `statusline-setup`, each with tool scopes. The task tools and `SendMessage` enable creating, monitoring, stopping, and messaging subagents.
