# Staten Island Map

## File Structure

- `map.html` contains the editor-style shell, panels, map surface, and script/style links.
- `styles.css` imports the smaller CSS files in `styles/`.
- `styles/base.css` contains global defaults and shared focus treatment.
- `styles/layout.css` contains the activity rail, left workspace, map editor area, and right agent panel layout.
- `styles/map.css` contains the map container.
- `styles/search-box.css` contains app-owned styling for the Mapbox Search Box host.
- `styles/workspace.css` contains the left sidebar tabs, address list, sources, and assets list.
- `styles/records.css` contains expandable query record cards and JSON accordions.
- `styles/agent.css` contains the right agent chat panel.
- `scripts/config.js` contains shared constants.
- `scripts/map.js` contains Mapbox map setup.
- `scripts/search.js` contains Search Box setup and selected place state.
- `scripts/pluto.js` contains generic query helpers, MAPPLUTO constants, and GeoJSON polygon map toggles.
- `scripts/sources.js` contains the Sources tab endpoint editor and manual query runner.
- `scripts/records.js` contains in-memory request/response records and JSON rendering.
- `scripts/assets.js` contains PDF/image URL extraction into the Assets tab.
- `scripts/agent.js` contains the right-side chat UI and attach-context toggle.
- `scripts/workspace.js` contains left sidebar tab switching and selected address rendering.
- `scripts/app.js` wires the modules together.
- `resources/datasets.json` stores manually maintained dataset source definitions until there is a backend.

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

Create a local `.env` file from `.env.example` and set `MAPBOX_ACCESS_TOKEN` before using Mapbox-backed features. The `.env` file is ignored by git.

Current search options:

- `bbox`: Staten Island bounding box, limiting suggestions to the working area.
- `country`: `US`.
- `language`: `en`.
- `limit`: `6`.
- `proximity`: Staten Island center, biasing results nearby.

The Search Box component also receives a Mapbox theme in `scripts/search.js` so its border, radius, colors, shadow, and font stay aligned with this app's UI guidance.

### Dev Mode

Use dev mode to bypass Mapbox Search requests and select canned search results from `resources/seed.json` instead.

- Start local server: run `powershell -ExecutionPolicy Bypass -File .\dev-server.ps1` from the `Map App` folder, then open `http://localhost:5173/map.html?devMode=1`.
- Turn on: add `?devMode=1` to the URL.
- Turn off: add `?devMode=0` to the URL.
- After either URL toggle, the setting is remembered in `localStorage`.

`resources/seed.json` can be either an array of Mapbox-style search result objects, an object with a `searchResults` array, or a single FeatureCollection-like object with `features`.

## Dataset Source Behavior

When a search result is selected, the Mapbox Search source output mappings assign variables such as `selectedCoordinates` and `selectedAddress`. Dataset sources are not queried automatically. The Sources tab renders expandable dataset endpoint editors from `resources/datasets.json`, where parameters can reference variables by name, such as `selectedCoordinates`. Manual runs produce request/response records in Details, including duration in milliseconds. Polygon responses can be toggled on the map from those records.

Dataset source overview buttons open the configured ArcGIS REST layer overview in a new tab. Those pages include dataset descriptions, supported query formats, extents, and field lists.

Dataset source settings are recorded in `resources/datasets.json` so future dataset additions have a place to live before a server-backed save flow exists.

## Future Work

- Add generic GeoJSON map rendering for `Point`, `MultiPoint`, `LineString`, `MultiLineString`, `Polygon`, and `MultiPolygon`.
- Make map action buttons appear beside the exact supported JSON node: geometry objects, Feature objects, FeatureCollections, and supported file URL values.
- Preserve expanded JSON-node state when any inline action is clicked.
- Add a small copied-path affordance after right-click path copy, such as a short inline "Copied" status.
- Decide whether dataset output variables should be persisted in a shared visible variable inspector.
- Wire the right agent panel to Gemini later. Initial behavior should send the user message plus current query records when `Attach context` is active.
- Eventually replace manual `datasets.json` editing with an in-app add/edit/save source flow backed by a server.
