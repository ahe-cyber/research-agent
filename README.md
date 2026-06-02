# Research Agent

Research Agent is an agent-powered GIS and data research workspace for searching addresses and places, inspecting property and building-code records, running manual GIS source queries, viewing GeoJSON results on a map, and using query records for AI-assisted analysis.

## Overview

The app is designed to feel closer to an agent-powered code editor than a simple map page. It uses a fixed editor layout with a narrow activity rail, a left workspace sidebar, a central map editor, and a right agent sidebar.

Core capabilities include:

* Mapbox-powered address, place, landmark, and POI search for the configured working area.
* A development mode with canned search results for offline or token-free testing.
* Registry-backed dataset source editors.
* Manual dataset queries through an Express proxy API.
* In-memory query records with request, response, timing, and extracted output variables.
* Expandable JSON response trees.
* GeoJSON polygon visibility toggles on the map.
* PDF and image link extraction into an Assets tab.
* An AI agent panel that can use attached query records as context for analysis.

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

The search input is powered by Mapbox Search JS Web's `MapboxSearchBox`, which supports:

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

The Sources tab lists Mapbox Search plus registry-backed dataset sources as expandable source editors.

Dataset endpoint editors are loaded from:

```text
/api/datasets
```

The source registry is backed by:

```text
public/data/datasets.json
```

Dataset source settings can be saved from the Sources tab. The Express API writes edits back to `public/data/datasets.json`.

Dataset overview buttons open the configured ArcGIS REST layer overview in a new tab. Those pages include dataset descriptions, supported query formats, extents, and field lists.

### Assets

The Assets tab collects PDF and image links extracted from records.

### Agent

The right agent panel supports:

* A text composer
* An attach-context control

When context is attached, the agent can use the current query records alongside the user message for GIS and data analysis.

## Client Source Organization

The browser application is organized by feature so it can be migrated to Next.js gradually without combining file moves with framework changes.

```text
src/
  app/
    App.jsx
    initializeMapApp.js
  features/
    address-search/
      AddressTab.jsx
      SearchSourceControl.js
      providers/
        googlePlaces.js
        mapbox.js
        nycGeoSearch.js
    agents/
    assets/
    catalog/
    editor/
    formulas/
    map/
    postman/
    records/
    sources/
  lib/
    markdown.js
  main.jsx
```

Keep shared logic in `src/lib`, map rendering and GeoJSON logic in `src/features/map`, and feature-specific UI or controllers in their matching `src/features/*` folder. Avoid adding new browser modules to the old `src/map`, `src/workspace`, `src/agent`, or `src/utils` locations.

## Next.js Migration Plan

Complete one TODO block at a time. Keep each increment buildable and avoid changing application behavior unless the block explicitly requires it.

### TODO: Next.js Migration Increment 1 - Add TypeScript Checking - DONE

Add `typescript`, `tsconfig.json`, and an `npm run typecheck` script while keeping Vite as the runtime and bundler. Add declarations for the CDN-provided `maplibregl` and `mapboxsearch` globals. Do not install Next.js yet.

### TODO: Next.js Migration Increment 2 - Convert Framework-Neutral Modules - DONE

Rename and type the low-risk utility modules first:

```text
src/lib/markdown.js                  -> markdown.ts
src/features/map/config.js           -> config.ts
src/features/map/geojson.js          -> geojson.ts
src/features/map/basemaps.js         -> basemaps.ts
src/features/map/createMap.js        -> createMap.ts
```

Keep runtime behavior unchanged and run both `npm run build` and `npm run typecheck`.

### TODO: Next.js Migration Increment 3 - Convert Address Search Providers - DONE

Rename and type the search modules:

```text
src/features/address-search/SearchSourceControl.js       -> SearchSourceControl.ts
src/features/address-search/providers/mapbox.js          -> mapbox.ts
src/features/address-search/providers/googlePlaces.js    -> googlePlaces.ts
src/features/address-search/providers/nycGeoSearch.js    -> nycGeoSearch.ts
```

Define shared suggestion, retrieved-feature, provider, and destroyable-search-box interfaces. Preserve input text, focus behavior, and suggestion cleanup when switching providers.

### TODO: Next.js Migration Increment 4 - Add a Next.js Client Shell

Install `next` and add the App Router shell:

```text
src/app/layout.tsx
src/app/page.tsx
src/features/workspace/WorkspaceClient.tsx
next.config.ts
```

Keep the GIS workspace client-rendered initially. Mark `WorkspaceClient.tsx` with `"use client"` and render the existing workspace from it. Load MapLibre and Mapbox Search browser scripts through `next/script` or client-only imports. Do not migrate Express endpoints yet.

### TODO: Next.js Migration Increment 5 - Run Express Beside Next.js

Keep `server.cjs` as the backend temporarily. Add Next.js rewrites for `/api/:path*` so the Next.js client can call the existing Express endpoints without changing browser fetch URLs. Document the development commands for running both processes.

### TODO: Next.js Migration Increment 6 - Move Simple API Routes

Move low-risk Express endpoints into App Router Route Handlers one domain at a time:

```text
src/app/api/datasets/route.ts
src/app/api/hubs/route.ts
src/app/api/instruction/route.ts
src/app/api/tools/route.ts
```

Remove each matching Express handler only after verifying its Next.js replacement.

### TODO: Next.js Migration Increment 7 - Move External API Proxies

Migrate the query proxy and Postman routes:

```text
src/app/api/query/route.ts
src/app/api/postman/collections/route.ts
src/app/api/postman/collections/[id]/route.ts
```

Keep Postman credentials server-only. Verify JSON error responses and upstream failure handling.

### TODO: Next.js Migration Increment 8 - Move Agent APIs

Migrate the agent registry and chat endpoints last:

```text
src/app/api/agents/route.ts
src/app/api/agent/chat/route.ts
```

Preserve Gemini credentials as server-only environment variables. Move shared backend helpers out of `server.cjs` into typed server modules as needed.

### TODO: Next.js Migration Increment 9 - Remove the Legacy Server

After every endpoint has a Route Handler, remove `server.cjs`, Express, and the temporary API rewrites. Replace Vite scripts with Next.js scripts and confirm development, production build, and production start behavior.

### TODO: Next.js Migration Increment 10 - Adopt Next.js Features Selectively

Once parity is established, evaluate route-based editor views, server-rendered non-map pages, `next/font`, `next/script`, and code splitting. Keep the interactive GIS map in a client component unless there is a concrete reason to change that boundary.

## Future Work

Each item below should have its own TODO section so it can be picked up as an implementable Codex task from VS Code.

### TODO: JSON Crack Graph View Tab

Add a `jsoncrack-react` graph-view tab in the central editor panel, opened like a VS Code-style tab, for visualizing JSON records as an interactive graph.

### TODO: Dataset Output Variable Inspector

Decide whether dataset output variables should be persisted in a shared visible variable inspector.

### TODO: Googly Eyes AI Attention

Implement draggable, placeable AI googly eyes on screen that can direct the AI’s attention.

### TODO: Migrate to MapLibre

Evaluate replacing Mapbox GL JS with MapLibre where feasible.

### TODO: Blind Mode Response Policy

Allow the agent to answer from lightweight assumptions and general knowledge only, without tool use or chat history, while asking a brief clarification when the request depends on missing selected context.

### TODO: UI Convenience

Add resizable panels, tileable tabs, and related workspace conveniences.

### TODO: User-Configurable Agent Flow

Allow users to define, save, inspect, and reuse bounded GIS agent workflows.

### TODO: reconsider prompt for search dataset make it output less

### TODO: agent doesnt have understanding of caller agent role.

### TODO: allow agent to see map viewport
