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

### Dataset

The Dataset tab lists registry-backed datasets as expandable editors. Address search items have a separate editor opened from the Address workspace.

Dataset endpoint editors are loaded from:

```text
/api/datasets
```

The dataset registry is backed by:

```text
public/data/dataset.json
```

Dataset settings can be saved from the Dataset tab. The API writes edits back to `public/data/dataset.json`.

Search settings are loaded from `/api/searchsources` and currently backed by list-shaped `public/data/search.json`. Dataset browser entries also live in `search.json` with `activity: "dataset"`. Other list-shaped registries include `activity.json`, `agent.json`, `dataset.json`, and `basemap.json`.

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
```

Keep shared logic in `src/lib`, map rendering and GeoJSON logic in `src/features/map`, reusable editor components in `src/features/editor`, and feature-specific UI or controllers in their matching `src/features/*` folder. Follow Next.js naming and routing conventions for new modules. Avoid adding new browser modules to old or ad hoc locations.

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

The project has TypeScript checking, typed framework-neutral map utilities, typed address-search providers, a Next.js App Router client shell, and typed App Router route handlers for datasets, hubs, global instruction, tool declarations, search sources, terrain tiles, query proxying, Postman collections, agent registry, and Gemini agent chat. The workspace runs through Next.js for development, production build, and production start; the legacy Express/Vite server has been removed. The app already includes registry-backed datasets, hubs, agents, basemaps, and search sources; configurable search-source editing; source cards; map layer source inspection with list and table modes; agents; editor tabs; Postman collections; catalog browsing; and shared editor page primitives. The editor shell now uses typed React `PageMenu`, `PageListView`, `PageTableView`, and `PageGraphView` primitives, with remaining imperative panel controls bridged through React roots. Catalog editor cards are expandable with read-only summaries and expanded edit controls. Migration is incomplete: several UI controllers remain imperative DOM modules, several files still use JavaScript or JSX, and styles remain plain CSS.

## TODO

Complete one TODO block at a time. Before implementing a block, stage all changes and create a Git commit with a message that describes in one or two simple sentences what you are about to do. Keep each increment buildable, prefer typed Next.js components, and preserve existing behavior unless a task explicitly changes it. When a block is complete, change `TODO` to `DONE` and replace its instruction block with a brief summary of what was implemented. Then review the remaining TODO blocks for changed assumptions or dependencies and revise their instructions when the current state has made them outdated. Stage the related changes, but do not commit after completing a TODO. If there are too many DONE items, compact them. If there are TODO items without instruction or detail, populate them based on the title line.

### TODO: Analyze current project against conventional nextjs app

Lookup nextjs documentation, compare suggested use with current structure. suggest changes, suggest features that might benefit for certain goal.

### TODO: Migrate CSS to SCSS

Adopt SCSS incrementally after the component boundaries are clearer. Start with shared variables for colors, spacing, borders, and editor surfaces, then migrate styles by feature without mixing visual redesign into the stylesheet conversion.

### TODO: Consider DXF IFC support for importing exporting to CAD/BIM systems

How to mount a folder, support multiple file types.

## Future Work

- JSON Crack or another Graph View for records

- Blind Mode use case

- resizable panels

- Restore Editor Tabs on Reload

- reconsider prompt for search dataset make it output less

- allow agent to see map viewport

- Fix collections clipping off card issue
