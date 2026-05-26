# Staten Island Map

## File Structure

- `index.html` loads the React app and Mapbox libraries.
- `src/App.jsx` renders the editor-style shell, activity bar, workspace tab selection, map surface, and agent panel.
- `src/main.jsx` mounts the React app.
- `src/mapApp.js` wires the map, search, workspace controllers, source editors, records, assets, and agent panel together.
- `src/map/` contains shared env, Mapbox map/search setup, query helpers, and GeoJSON map rendering.
- `src/workspace/AddressTab.jsx` renders the Address tab and contains its address-list controller.
- `src/workspace/DetailsTab.jsx` renders the Details tab and contains the record store, JSON tree, and record controller.
- `src/workspace/SourcesTab.jsx` renders the Sources tab and contains the source editor/manual query controller.
- `src/workspace/AssetsTab.jsx` renders the Assets tab and contains PDF/image URL extraction and asset-list controller.
- `src/agent/AgentPanel.jsx` renders the agent panel and contains its UI controller.
- `styles.css` imports the smaller CSS files in `styles/`.
- `styles/base.css` contains global defaults and shared focus treatment.
- `styles/layout.css` contains the activity rail, left workspace, map editor area, and right agent panel layout.
- `styles/map.css` contains the map container.
- `styles/search-box.css` contains app-owned styling for the Mapbox Search Box host.
- `styles/workspace.css` contains the left sidebar tabs, address list, sources, and assets list.
- `styles/records.css` contains expandable query record cards and JSON accordions.
- `styles/agent.css` contains the right agent chat panel.
- `server.cjs` runs the Express API and, in development, Vite middleware.
- `public/resources/datasets.json` stores dataset source definitions and can be updated through the Express API.

## UI Style Guidance

- The app should feel closer to an agent-powered code editor than a simple map page.
- Use a fixed editor layout: narrow activity rail, left workspace sidebar, central map editor, right agent sidebar.
- Keep panels quiet and utilitarian: white surfaces (`#ffffff`), near-black text/icons (`#1f2933`), muted secondary text (`#526070`), and light gray borders (`#d6d9de`).
- Use compact 4px-6px radii, restrained shadows, and dense but readable spacing.
- The left workspace has these tabs: Address, Details, Sources, Assets.
- The Address tab always contains the search input. There is no add popup.
- The Sources tab lists Mapbox Search plus registry-backed dataset sources as expandable source editors.
- The Details tab shows in-memory query records. Search keeps only the latest selected result response; manual dataset queries keep request, response, timestamp, duration, and extracted output variables.
- JSON responses should render as expandable accordion trees.
- If a record response is a GeoJSON polygon, FeatureCollection of polygons, or list of polygon features, the record should expose a map visibility toggle.
- If a record includes PDF or image links, the record should expose a way to collect those links into the Assets tab.
- The right agent panel should support a text composer and an attach-context control. For now this is UI-only; future Gemini integration should send the message plus current query records when context is attached.

## Search Behavior

The Address tab uses Mapbox Search JS Web's `MapboxSearchBox`, which supports addresses, place names, landmarks, and POIs.

Create a local `.env` file from `.env.example` and set `VITE_MAPBOX_ACCESS_TOKEN` before using Mapbox-backed features. The `.env` file is ignored by git.

Current search options:

- `bbox`: Staten Island bounding box, limiting suggestions to the working area.
- `country`: `US`.
- `language`: `en`.
- `limit`: `6`.
- `proximity`: Staten Island center, biasing results nearby.

The Search Box component also receives a Mapbox theme in `src/map/search.js` so its border, radius, colors, shadow, and font stay aligned with this app's UI guidance.

### Dev Mode

Use dev mode to bypass Mapbox Search requests and select canned search results from `public/resources/seed.json`, served at `/resources/seed.json`, instead.

- Install dependencies: run `npm install`.
- Start local server: run `npm run dev`, then open `http://localhost:5173/?devMode=1`.
- Turn on: add `?devMode=1` to the URL.
- Turn off: add `?devMode=0` to the URL.
- After either URL toggle, the setting is remembered in `localStorage`.

`public/resources/seed.json` can be either an array of Mapbox-style search result objects, an object with a `searchResults` array, or a single FeatureCollection-like object with `features`.

## Dataset Source Behavior

When a search result is selected, the Mapbox Search source output mappings assign variables such as `selectedCoordinates` and `selectedAddress`. Dataset sources are not queried automatically. The Sources tab renders expandable dataset endpoint editors from `/api/datasets`, backed by `public/resources/datasets.json`, where parameters can reference variables by name, such as `selectedCoordinates`. Manual runs produce request/response records in Details, including duration in milliseconds. Supported GeoJSON responses can be toggled on the map from those records.

Dataset source overview buttons open the configured ArcGIS REST layer overview in a new tab. Those pages include dataset descriptions, supported query formats, extents, and field lists.

Dataset source settings can be saved from the Sources tab. The Express API writes those edits back to `public/resources/datasets.json`.

Dataset source queries are proxied through `POST /api/query` so external endpoints can be requested server-side instead of being blocked by browser CORS.

## Future Work

Each future-work item has its own TODO section so it can be picked up as an implementable Codex task from VS Code.

## TODO - JSON Crack Graph View Tab

Add a `jsoncrack-react` graph-view tab in the central editor panel, opened like a VS Code-style tab, for visualizing JSON records as an interactive graph.

## TODO - Dataset Output Variable Inspector

Decide whether dataset output variables should be persisted in a shared visible variable inspector.

## TODO - Gemini Agent Integration

Wire the right agent panel to Gemini later. Initial behavior should send the user message plus current query records when `Attach context` is active.

## TODO - Postman-Style Query Param Sync

Sync Source Query URL parameters and Input Params in both directions, similar to Postman, while keeping variable references in Input Params instead of requiring `{{variable}}` syntax directly in the URL.

## TODO - Safe Formula Authoring

Allow users or the agent to create new formulas through a constrained, validated configuration flow that avoids arbitrary code execution and code injection.
