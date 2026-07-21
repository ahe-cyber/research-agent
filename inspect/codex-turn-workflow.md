# Codex Turn Workflow Notes

Source: `inspect/codex-example.jsonl`

## Transcript Shape

The Codex sample is append-only JSONL. Top-level records include:

- `session_meta`: session id, cwd, originator, CLI/source metadata, model provider, and visible base instructions.
- `event_msg`: lifecycle and commentary events such as `task_started` and `agent_message`.
- `turn_context`: per-turn runtime context including cwd, workspace roots, date, timezone, sandbox policy, permission profile, model, effort, collaboration mode, and multi-agent version.
- `response_item`: user/developer/assistant messages plus function-call outputs.
- `compacted`: replacement history used when context is summarized.
- `world_state`: later snapshot of active environment, filesystem, apps, and runtime state.

## Agentic Continuation

Codex continues across a goal by preserving turn context, response items, tool outputs, compaction summaries, and world state. A later turn can resume from the current cwd and summarized state instead of restarting from raw chat history.

The transcript shows explicit interruption handling with a user message containing `<turn_aborted>`. Codex treats this as an intentional stop and can continue later while accounting for partially executed commands.

## Skills

Skills are supplied as developer-visible instructions. The sample includes skill file contents in function outputs after the agent reads the selected skill. A separate skill listing appears in the runtime/developer layer rather than being inferred from the project.

Live Codex or editor skill directories are intentionally not linked into this project. The research-agent skill feature is project-specific and uses `public/data/skills/<skill-name>/SKILL.md` instead.

## Tools And MCP

Codex receives tool availability in developer messages and turn context. The visible sample includes:

- filesystem and shell execution policy
- sandbox and approval policy
- apps/connectors instructions
- skill instructions
- tool call outputs as `response_item` records

Tools are not passed as normal user content. They are part of the harness state for each turn.

## System Instructions

The sample exposes Codex base instructions in `session_meta.payload.base_instructions.text`. It also injects per-turn developer instructions such as permissions, collaboration mode, app connector handling, and skill routing.

See `codex-visible-system-instructions.md` for a compact extraction of the visible system/developer instruction layers.

## Agent Orchestration

The sample has `multi_agent_version: "v1"` in turn context. It also includes world-state and app/tool instructions that enable connectors and deferred tools. Orchestration is therefore harness-mediated: the primary model receives available tools/subsystems, can call them, and persists enough state for later turns or compaction.
