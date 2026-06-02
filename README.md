# Agentic AEC IDE

The project is an **Agentic AEC IDE**: a visual, extensible environment where AI agents, tools, skills, MCP servers, project data, and human workflows come together to support architectural work across research, schematic design, filing, reporting, presentations, estimating, and project management.

## Overview

The current implementation is intentionally simple. It is an early GIS and data-research workspace for searching addresses and places, inspecting records, running source queries, viewing map results, and using attached records for AI-assisted analysis. The interface is designed to feel closer to an editor than a single-purpose map page, with a narrow activity rail, a left workspace sidebar, a central editor, and a right agent sidebar.

Current capabilities include:

* Configurable address and place search sources, including NYC GeoSearch, Mapbox Search, and Google Places.
* Registry-backed dataset source editors.
* Manual dataset queries through an Express proxy API.
* In-memory query records with request, response, timing, and extracted output variables.
* Expandable JSON response trees.
* GeoJSON polygon visibility toggles on the map.
* PDF and image link extraction into an Assets tab.
* An AI agent panel that can use attached query records as context for analysis.

## Engineering Conventions

The project is migrating incrementally to Next.js. New code should follow the intended architecture even while legacy modules remain in place:

* Favor Next.js App Router structure and React components for new UI work.
* Prefer `.tsx` for components and `.ts` for application logic. Add new `.js` or `.jsx` files only when touching a legacy boundary makes that unavoidable.
* Keep feature-specific code under `src/features/*`, reusable UI components under an appropriate shared feature folder, and route handlers under `src/app/api/*`.
* Prefer data-driven behavior over hard-coded configuration. The current registries are JSON files under `public/data`.
* Extract reusable components when multiple editor pages share layout or interaction patterns, especially menus, list views, table views, graph views, cards, and action rows.
* Keep each migration increment buildable. Avoid combining broad file moves, visual redesigns, and behavior changes unless they belong to the same focused task.

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

## Workspace Tabs

### Address

The Address tab always contains the search input. There is no add popup.

The active search provider is selected from the search-source registry. Available providers currently include NYC GeoSearch, Mapbox Search JS Web's `MapboxSearchBox`, and Google Places. Configured sources can support:

* Addresses
* Place names
* Landmarks
* POIs

### Details

The Details tab shows in-memory query records.

Address searches keep only the latest selected result response. Manual dataset queries keep:

* Request
* Response
* Timestamp
* Duration
* Extracted output variables

JSON responses should render as expandable accordion trees.

If a record response is a GeoJSON polygon, a FeatureCollection of polygons, or a list of polygon features, the record should expose a map visibility toggle.

If a record contains PDF or image links, the record should expose a way to collect those links into the Assets tab.

### Sources

The Sources tab lists registry-backed dataset sources as expandable source editors. Search sources have a separate editor opened from the Address workspace.

Dataset endpoint editors are loaded from:

```text
/api/datasets
```

The source registry is backed by:

```text
public/data/datasets.json
```

Dataset source settings can be saved from the Sources tab. The Express API writes edits back to `public/data/datasets.json`.

Search source settings are loaded from `/api/searchsources` and currently backed by `public/data/searchsource.json`.

Dataset overview buttons open the configured ArcGIS REST layer overview in a new tab. Those pages include dataset descriptions, supported query formats, extents, and field lists.

### Assets

The Assets tab collects PDF and image links extracted from records.

### Agent

The right agent panel supports:

* A text composer
* An attach-context control

When context is attached, the agent can use the current query records alongside the user message for GIS and data analysis.

## Client Source Organization

The application is organized by feature while the Next.js migration is in progress. Some browser controllers still use imperative DOM code and some files remain JavaScript or JSX. Treat those as migration boundaries, not patterns for new work.

```text
src/
  app/
    App.jsx
    initializeMapApp.js
    layout.tsx
    page.tsx
  features/
    address-search/
      AddressTab.jsx
      SearchSourceControl.ts
      providers/
        googlePlaces.ts
        mapbox.ts
        nycGeoSearch.ts
    agents/
    assets/
    catalog/
    editor/
    formulas/
    map/
    postman/
    records/
    sources/
    workspace/
      WorkspaceClient.tsx
  lib/
    markdown.ts
  main.jsx
```

Keep shared logic in `src/lib`, map rendering and GeoJSON logic in `src/features/map`, reusable editor components in `src/features/editor`, and feature-specific UI or controllers in their matching `src/features/*` folder. Follow Next.js naming and routing conventions for new modules. Avoid adding new browser modules to old or ad hoc locations.

## Development

The current migration state runs Express beside Next.js. Start both processes:

```bash
# Terminal 1 - Express API on port 3001
npm run api:dev

# Terminal 2 - Next.js dev server on port 3000
npm run next:dev
```

Set matching ports when overriding the API port:

```bash
EXPRESS_PORT=4000 npm run next:dev
PORT=4000 npm run api:dev
```

## Current Progress

The project has TypeScript checking, typed framework-neutral map utilities, typed address-search providers, a Next.js App Router client shell, and an Express API running beside Next.js through rewrites. The workspace already includes registry-backed datasets, hubs, agents, basemaps, and search sources; configurable search-source editing; source cards; map layer source inspection with list and table modes; agent modules; editor tabs; Postman collections; catalog browsing; and shared editor menu groundwork. Migration is incomplete: several UI controllers remain imperative DOM modules, several files still use JavaScript or JSX, API routes still live in `server.cjs`, and styles remain plain CSS.

## TODO

Complete one TODO block at a time. Before implementing a block, create a Git commit with a message that describes in one or two simple sentences what you are about to do. Keep each increment buildable, prefer typed Next.js components, and preserve existing behavior unless a task explicitly changes it. When a block is complete, change `TODO` to `DONE` and replace its instruction block with a brief summary of what was implemented. Then review the remaining TODO blocks for changed assumptions or dependencies and revise their instructions when the current state has made them outdated.

### DONE: Continue the Next.js Component Migration

Added typed React `PageMenu`, `PageListView`, `PageTableView`, and `PageGraphView` primitives. Migrated the layer-sources editor page to React as the first working page: its list/table toggles live in `PageMenu`, and its `Copy as TSV` action lives in `PageTableView`. A typed `PageMenu` DOM adapter keeps the remaining legacy panels buildable while they migrate incrementally.

### TODO: Migrate Remaining Editor Panels to React

Move the remaining imperative editor panels to the typed page primitives one working page at a time. Catalog now uses the shared menu and list-view primitives, but still uses a DOM adapter. Retire the temporary `createPageMenu` and `createPageListView` DOM adapters after the sources editor, search-sources editor, Postman collections editor, catalog editor, and agent-modules editor no longer depend on them.

### TODO: Normalize Catalog Page Menu and Cards

Bring the Catalog editor fully in line with the other shared page-menu panels. Remove the visible `CATALOGS` menu label, put the add-catalog action on the left using the same compact icon-button style as the other add actions, and keep save status subtle. Make catalog cards expandable and collapsible, with read-only collapsed summaries and editing controls available only while a card is expanded.

### TODO: Move Simple API Routes

Move low-risk Express endpoints into App Router Route Handlers one domain at a time:

```text
src/app/api/datasets/route.ts
src/app/api/hubs/route.ts
src/app/api/instruction/route.ts
src/app/api/tools/route.ts
src/app/api/searchsources/route.ts
```

Keep the JSON registries as the current data source. Remove each matching Express handler only after verifying its typed Next.js replacement.

### TODO: Move External API Proxies

Migrate the query proxy and Postman routes:

```text
src/app/api/query/route.ts
src/app/api/postman/collections/route.ts
src/app/api/postman/collections/[id]/route.ts
```

Keep Postman credentials server-only. Verify JSON error responses and upstream failure handling.

### TODO: Move Agent APIs

Migrate the agent registry and chat endpoints last:

```text
src/app/api/agents/route.ts
src/app/api/agent/chat/route.ts
```

Preserve Gemini credentials as server-only environment variables. Move shared backend helpers out of `server.cjs` into typed server modules as needed.

### TODO: Remove the Legacy Server

After every endpoint has a Route Handler, remove `server.cjs`, Express, and the temporary API rewrites. Replace Vite scripts with Next.js scripts and confirm development, production build, and production start behavior.

### TODO: Adopt Next.js Features Selectively

Once parity is established, evaluate route-based editor views, server-rendered non-map pages, `next/font`, `next/script`, and code splitting. Keep the interactive GIS map in a client component unless there is a concrete reason to change that boundary.

### TODO: Migrate CSS to SCSS

Adopt SCSS incrementally after the component boundaries are clearer. Start with shared variables for colors, spacing, borders, and editor surfaces, then migrate styles by feature without mixing visual redesign into the stylesheet conversion.

## Future Work

- JSON Crack or another Graph View for records

- Blind Mode use case

- resizable panels

- Restore Editor Tabs on Reload

- reconsider prompt for search dataset make it output less

- agent doesnt have understanding of caller agent role.

- allow agent to see map viewport
