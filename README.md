# Agentic AEC IDE

The project is an **Agentic AEC IDE**: a visual, extensible environment where AI agents, tools, skills, MCP servers, project data, and human workflows come together to support architectural work across research, schematic design, filing, reporting, presentations, estimating, and project management.

## Overview

The current implementation is intentionally simple. It is an early GIS and data-research workspace for searching addresses and places, inspecting records, running source queries, viewing map results, and using attached records for AI-assisted analysis. The interface is designed to feel closer to an editor than a single-purpose map page, with a narrow activity rail, a left workspace sidebar, a central editor, and a right agent sidebar.

Current capabilities include:

* Configurable address and place search sources, including NYC GeoSearch, Mapbox Search, and Google Places.
* Registry-backed dataset source editors.
* Manual dataset queries through a server-side proxy API.
* In-memory query records with request, response, timing, and extracted output variables.
* Expandable JSON response trees.
* GeoJSON polygon visibility toggles on the map.
* PDF and image link extraction into the Folder tab.
* An AI agent panel that can use attached query records as context for analysis.

## Engineering Conventions

The project is migrating incrementally to Next.js. New code should follow the intended architecture even while legacy modules remain in place:

* Favor Next.js App Router structure and React components for new UI work.
* Prefer `.tsx` for components and `.ts` for application logic. Add new `.js` or `.jsx` files only when touching a legacy boundary makes that unavoidable.
* Keep feature-specific code under `src/features/*`, reusable UI components under an appropriate shared feature folder, and route handlers under `src/app/api/*`.
* Prefer data-driven behavior over hard-coded configuration. The current registries are JSON files under `public/data`.
* Extract reusable components when multiple editor pages share layout or interaction patterns, especially menus, list views, table views, graph views, cards, and action rows.
* Keep each migration increment buildable. Avoid combining broad file moves, visual redesigns, and behavior changes unless they belong to the same focused task.

Activity nomenclature must stay absolutely consistent. Use the canonical singular activity ids from `public/data/activity.json` everywhere an activity identity appears: `project`, `folder`, `address`, `record`, `dataset`, `tool`, `agent`, and `map`. Folder names, filenames, exported component names, controller/function names, CSS namespace roots, route folders, object keys, and object values should use the same singular activity word when they refer to that activity. Do not reintroduce plural or legacy aliases such as `agents`, `datasets`, `tools`, `sources`, `assets`, `records`, `details`, or `formulas` for activity-owned code.

## UI Style Guidance

The interface should remain quiet, utilitarian, and editor-like.

Use:

* White panel surfaces: `#ffffff`
* Near-black text and icons: `#1f2933`
* Muted secondary text: `#526070`
* Light gray borders: `#d6d9de`
* Compact `4px–6px` border radii
* Restrained shadows
* Dense but readable spacing

The layout should remain fixed:

```text
Activity rail → Workspace sidebar → Map editor → Agent sidebar
```

## Activity Tabs

### Address

### Record

### Dataset

### Folder

### Agent

## Client Source Organization

## API Source Organization

## Development

Run the Next.js development server:

```bash
npm run dev
```

Create a production build and run it locally:

```bash
npm run build
npm run start
```

## Current Progress

The project has TypeScript checking, typed framework-neutral map utilities, typed search providers, a Next.js App Router client shell, and typed App Router route handlers for the `dataset`, `search`, `agent`, `tool`, `terrain`, `overlay`, `geometry`, `proxy`, `postman`, and Gemini chat domains. The workspace runs through Next.js for development, production build, and production start; the legacy Express/Vite server has been removed. The app already includes registry-backed dataset entries, catalog entries, agent entries, basemaps, search entries, server-backed PDF overlay references, and custom geometry layers; configurable search-source editing; source cards; map layer source inspection with list and table modes; agent workflows; editor tabs; Postman collections; catalog browsing; and shared editor page primitives. Address and Dataset search now share the same search widget shell/dropdown styling; Dataset exposes catalog choices as a provider dropdown and autocompletes top records for the active catalog. The API folder now separates private `_lib` helpers, `_services` provider/model logic, and thin domain route handlers. The editor shell now uses typed React `PageMenu`, `PageListView`, `PageTableView`, and `PageGraphView` primitives, with remaining imperative panel controls bridged through React roots. Migration is incomplete: several UI controllers remain imperative DOM modules, several files still use JavaScript or JSX, and styles remain plain CSS.

## TODO

Complete one TODO block at a time. Before implementing a block, stage all changes and create a Git commit with a message that describes in one or two simple sentences what you are about to do. Keep each increment buildable, prefer typed Next.js components, and preserve existing behavior unless a task explicitly changes it. When a block is complete, change `TODO` to `DONE` and replace its instruction block with a brief summary of what was implemented. Then review the remaining TODO blocks for changed assumptions or dependencies and revise their instructions when the current state has made them outdated. Stage the related changes, but do not commit after completing a TODO. If there are too many DONE items, compact them. If there are TODO items without instruction or detail, populate them based on the title line.

### DONE: Analyze current project against conventional Next.js app

Reviewed the current structure against the current Next.js App Router documentation:

* The project is aligned with App Router basics: source lives under the supported `src` folder, `src/app/page.tsx` is a Server Component by default, route handlers live under `src/app/api/*/route.ts`, and the interactive map is isolated behind a client component (`WorkspaceClient`) that loads browser-only scripts with `next/script`.
* Keep the map/editor shell as a client boundary because it depends on state, effects, `window`, MapLibre, and Mapbox Search. Use Server Components selectively for future non-map routes such as dataset documentation, reports, settings summaries, saved project overviews, and read-only catalog pages.
* Preserve route handlers for server-side proxying, registry reads/writes, Postman calls, and agent chat. Add explicit cache policy only where a GET endpoint is truly static or safely revalidated; registry-editing endpoints and query proxies should remain request-time behavior.
* Move toward component-level CSS Modules or SCSS Modules for newly migrated React components, keeping global CSS only for app-wide reset/layout tokens until the SCSS TODO is implemented.
* Consider adding route groups for future sections such as `(workspace)`, `(reports)`, or `(settings)` once multiple pages exist. Do not split the current single-screen editor into route segments until there is a real navigation or persistence goal.
* Useful Next.js docs for follow-up decisions: [App Router](https://nextjs.org/docs/app), [Project Structure](https://nextjs.org/docs/app/getting-started/project-structure), [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [CSS](https://nextjs.org/docs/app/getting-started/css), [Sass](https://nextjs.org/docs/app/guides/sass), and [`fetch`](https://nextjs.org/docs/app/api-reference/functions/fetch).

### DONE: Organize Project Structure

Renamed feature packages, API folders, and exported tab/controller names to align with `public/data/activity.json`: `agent`, `dataset`, `folder`, `record`, `search`, and `tool` now replace the prior plural or legacy folders. Address search and catalog browsing now live under `src/features/search`, the old assets tab is represented as `FolderTab`, and the Browser activity was removed because catalog browsing is part of search. The Dataset tab now uses the same `SearchWidget` family as Address: catalog entries are dropdown choices and typed queries autocomplete top records from the selected catalog. The activity rail derives its default labels/icons from `activity.json` so the UI and registry stay synchronized. API routes were reorganized around `/api/search/*`, `/api/agent/*`, `/api/dataset`, and `/api/proxy/query`, with provider logic extracted into private `_services`.

### DONE: Convert Activity Controllers to Typed React Packages (folder and tool)

Converted the `folder` and `tool` activities from imperative DOM controllers to typed React modules:

* **folder** — `FolderTab.jsx` replaced by `FolderTab.tsx`. Asset state lives in `useState`. The component is a `forwardRef` that exposes a `FolderController` handle (`addFromRecord`, `addFromValue`) via `useImperativeHandle` so future callers can push assets from records. `hasAssetUrls` remains an exported pure function. The old `createFolderController` (which was never wired) is removed.
* **tool** — `ToolTab.jsx` replaced by `ToolTab.tsx`. Tool list state lives in `useState`; the API fetch runs in `useEffect`. The component accepts an `onSuggestTool` callback prop instead of a `getAgentController` closure. The built-in tool functions (`applyBuiltin`, `hasBuiltin`, and `BUILTINS`) are extracted into `src/features/tool/builtins.ts` and imported directly by `initializeMapApp` as a plain `builtinController` object passed to the dataset controller.
* **App.jsx** — Imports the new `.tsx` tab components. Holds a `folderRef` (passed to `FolderTab`) and a `suggestToolRef` (populated by `initializeMapApp` after the agent controller is ready). A stable `onSuggestTool` callback reads from `suggestToolRef` and is passed to `ToolTab`.
* **initializeMapApp.js** — Accepts `{ folderRef, suggestToolRef }` options. Replaces `createToolController` with direct imports from `src/features/tool/builtins.ts`. Sets `suggestToolRef.current` to the agent controller's `suggestTool` method immediately after the agent controller is created.

Remaining activities (`record`, `dataset`, `search`, `agent`) still use imperative DOM controllers and are next in the migration sequence.

### DONE: Add Resizable and Persisted Workbench Layout

Replaced the fixed `grid-template-columns: 48px 360px minmax(360px, 1fr) 380px` in `layout.css` with `48px 1fr`. The 48 px activity rail stays fixed. The remaining three columns (sidebar, editor, agent panel) are now driven by `react-resizable-panels` v4 through a new `src/features/workspace/WorkbenchLayout.tsx` component:

* `Group` wraps the three resizable panels with `orientation="horizontal"`.
* `Panel` ids are `sidebar`, `editor`, and `agent`; default sizes are 22 / 56 / 22 percent.
* Sidebar and agent panels set `collapsible` so they can be fully dragged shut.
* `onLayoutChanged` (fires on pointer-up) saves the `Layout` dict to `workspaceState` under the key `panelLayout`; on next load the saved layout is validated and passed back to `Group` via `defaultLayout`.
* `Separator` elements carry the `workbench-resize-handle` class — a 4 px invisible hit zone that turns `#2f6fed` on hover or while dragging.
* `height: 100%` was added to `.workspace-sidebar`, `.editor-area`, and `.agent-panel` so they fill their panel containers (the previous CSS grid stretched them automatically; the flex-based Panel layout requires explicit height).

### DONE: Add CAD/BIM Folder Mounts and File Parsers

Added File System Access API folder mounting and client-side parsers for PDF, DXF, and IFC in `src/features/folder/`:

* **`folderMount.ts`** — `mountFolder()` calls `showDirectoryPicker({ mode: 'read' })`, walks the directory tree up to 5 levels deep, and returns a `MountedFolder` with a `FileEntry[]` filtered to `.pdf`, `.dxf`, and `.ifc`. `parseFile(entry)` dynamically imports the appropriate parser. `isFolderMountSupported()` gates the mount button on browser support.
* **`parsers/pdf.ts`** — uses `pdfjs-dist` (dynamic import, worker at `/pdf.worker.min.mjs`). Extracts per-page text via `getTextContent()` and concatenates to `fullText`.
* **`parsers/dxf.ts`** — uses `dxf-parser`. Extracts layer names, entity type counts, and all `TEXT`/`MTEXT` string content.
* **`parsers/ifc.ts`** — uses `web-ifc` (WASM singleton at `/web-ifc.wasm`, cached across files). Reads schema from raw file text, then queries `GetLineIDsWithType` for project name, storey names, space names, and counts of walls, slabs, columns, beams, doors, windows, stairs, roofs, and furnishings.
* **`FolderTab.tsx`** — updated with a "Mount folder" button (hidden when the API is unavailable), per-mount file lists, per-file "Parse" buttons, and inline `ParseResultView` components for each type. Existing asset-URL collection from agent records is preserved below the mounts.
* **`package.json`** — added `pdfjs-dist`, `dxf-parser`, `web-ifc`; `postinstall` script copies the PDF worker and IFC WASM to `public/`.

Scope: read-only import and inspect only; no export, no 3D rendering. Parse results are structured for future AI context attachment.

### TODO: Add Record Graph and JSON Inspection

Add a graph view for records, variables, source queries, attached assets, and agent messages using `@xyflow/react`. Keep the existing JSON accordion for precise inspection, and use the graph for relationships rather than raw JSON rendering. The graph should open from Record and support selecting nodes to reveal the existing record detail/table views.

### TODO: Give Agents Map, Record, and UI Context (Multimodal, screenshot, extent, records, camera location)

Extend agent context with the current map viewport, visible GeoJSON layers, selected records, active project, and open editor tab metadata. Keep the agent payload compact by sending summaries plus stable record IDs, and let tools fetch full records when needed. Validate tool inputs with `zod` before executing registry edits, source queries, catalog search, or agent-to-agent calls.

### TODO: Persist Project and Editor State

Consolidate the scattered `localStorage` keys (`workspace-state`, `layer-fields-folded`) into a single typed `ProjectState` object. Create `src/lib/projectStore.ts` with `loadProject`/`saveProject` backed by `localStorage`. Define `ProjectState` in `src/lib/project.ts` covering `activeActivity`, `activityOrder`, `panelLayout`, `openEditorTabs`, `activeEditorTab`, `mapViewport`, `selectedDatasetSourceId`, `selectedAddressSourceId`, and `layerFieldsCollapsed`. Migrate the four callers (`App.jsx`, `EditorTabs.js`, `WorkbenchLayout.tsx`, `DatasetTab.jsx`) then delete `src/lib/workspaceState.js`. No new packages needed.

### TODO: Add Multimodal RAG for Building Codes, Drawings, and Models

Use `@google/genai` for Gemini chat, multimodal inputs, and embeddings, `pdfjs-dist` for PDF text/page extraction, `@lancedb/lancedb` for local vector tables, and the CAD/BIM packages from the Folder TODO for geometric files. Store source chunks, citations, thumbnails, and extracted entities as project records. Start with building-code PDFs and dataset metadata before adding image-heavy sheets or full IFC semantic extraction.

### TODO: Migrate CSS to SCSS

Install `sass` and adopt SCSS incrementally on top of the activity-aligned stylesheet files. Start with shared variables and mixins for colors, spacing, borders, icon masks, and editor surfaces, then migrate `styles/base.css`, `styles/layout.css`, and one activity stylesheet at a time without mixing visual redesign into the stylesheet conversion.
