# Changelog

## v0.0.9 - 2026-07-29

- Continued the feature-folder refactor across sidebar, editor, agent, API routes, and data schemas.
- Replaced legacy sidebar panels with data-driven sidebar items and source/search widgets.
- Added editable JSON views with raw, edit, list, table, and graph modes.
- Moved agent chat into React state with persisted session data and source records.
- Added in-memory feature invalidation timestamps for `info` and `detail` refresh flows.

## v0.0.8 - 2026-07-28

- Moved the app shell from legacy JSX toward React TSX area components.
- Reorganized feature code around sidebar, editor, server, schema, API, and provider boundaries.
- Added shared feature API route handling and feature-root icon loading.
- Removed deprecated OLD files and empty API folders from the active app path.

## v0.0.7 - 2026-07-27

- Added changelog maintenance and recovered prior version notes.
- Added editor shell components and improved raw JSON wrapping.
- Moved the sidebar header above the feature navbar and content panel.
- Replaced the view-menu toolbar with feature-title double-click edit routing.
- Removed dataset manual run buttons from the sidebar.
- Initialized missing app settings records in local storage.

## v0.0.6 - 2026-07-23

- Added rich skill editing with schema-marked rich fields.
- Moved app-owned skill markdown content into `data/features/skill.json`.
- Added skill source editing backed by `data/search.json`.
- Moved tool built-ins toward the shared tool provider structure.

## v0.0.5 - 2026-07-23

- Simplified the dataset sidebar flow around compact source cards.
- Reduced direct dataset sidebar actions in favor of opening records in the editor.

## v0.0.4 - 2026-07-23

- Completed settings and sidebar TODO updates.
- Added persisted app settings initialization and sidebar behavior fixes.

## v0.0.3 - 2026-07-23

- Continued the editor and sidebar refactor.
- Extracted shared editor actions and moved more panels toward reusable page views.

## v0.0.2 - 2026-07-22

- Continued sidebar and editor structure refactoring.
- Added version display and initial reusable sidebar/editor pieces.

## v0.0.1 - 2026-07-22

- Started explicit app version tracking.
- Established the baseline for the current Next.js research-agent workspace.
