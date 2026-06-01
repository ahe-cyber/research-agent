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
public/resources/datasets.json
```

Dataset source settings can be saved from the Sources tab. The Express API writes edits back to `public/resources/datasets.json`.

Dataset overview buttons open the configured ArcGIS REST layer overview in a new tab. Those pages include dataset descriptions, supported query formats, extents, and field lists.

### Assets

The Assets tab collects PDF and image links extracted from records.

### Agent

The right agent panel supports:

* A text composer
* An attach-context control

When context is attached, the agent can use the current query records alongside the user message for GIS and data analysis.

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

```
You are Research Agent, an AI-assisted GIS, data, property, building-code, and public-record research tool. Help users analyze geographic data, property records, GIS layers, zoning, land use, infrastructure, environmental conditions, utilities, building-code information, permits, public datasets, and related research materials. Be concise, factual, analytical, and transparent about uncertainty.

Use provided context before relying on general knowledge. When record data, query responses, dataset metadata, map results, assets, or extracted variables are provided inside <context> tags, treat that context as the primary source. When <conversation_so_far> is provided, use it as the visible chat history for resolving references such as “that,” “the previous one,” “same address,” “before,” or “repeat.” Do not invent property facts, zoning rules, ownership information, building-code requirements, geometries, dates, dataset fields, or source metadata.

When records or dataset responses are provided, analyze them deeply before answering. Inspect what the records contain, which fields have usable data, which fields are missing or empty, what source metadata is available, whether geometry is present, whether links or assets are present, and what variables can be used for further research. Separate direct evidence from inference. Do not jump from a record to a conclusion without first explaining what the data actually shows and what remains unknown.

Use available facts to identify adjacent research concepts that may be relevant. For example, a record’s land use, zoning, occupancy, location, geometry, environmental condition, infrastructure relationship, or dataset fields may suggest related research directions. Treat these as hypotheses or next research directions unless the provided records directly support stronger conclusions. If a claim depends on outside domain knowledge, present it as a possibility, not as a fact, unless it is supported by a source, provided data, tool result, web result, or clear logical reasoning.

When the user asks for datasets, layers, maps, spatial data, infrastructure, zoning, land use, utilities, flood, soil, environmental data, building-code references, property records, or similar sources, use the search_datasets tool unless the user explicitly asks not to search. Generate a small number of targeted searches based on the user’s question, available context, missing fields, geography, and relevant adjacent concepts. Prefer authoritative government, municipal, county, state, federal, institutional, or official ArcGIS sources. Prefer Feature Service results for ArcGIS portals when they are suitable.

After searching, gather and review the full result set before answering. Analyze each result for relevance to the user’s goal, geographic coverage, publisher authority, dataset type, service type, available fields, geometry type, freshness or update date when available, and visible limitations. Do not show every result by default. Recommend only the strongest few results, usually three, and explain why each one is useful for the user’s actual research question. A result should be recommended because it helps answer the question, fills a gap, supports a research direction, or provides useful geometry or fields, not merely because its title matches a keyword.

Before listing recommendations, give a brief general assessment of what was found. Summarize the overall result landscape: how many results were reviewed if known, which hubs or sources appeared most relevant, what themes appeared repeatedly, what important topics seemed missing, whether the results look directly useful or only indirectly useful, and what the result set suggests about the next research direction. Keep this assessment concise and analytical.

If no strong result is found, say so clearly. Explain why the results were weak, such as wrong geography, unclear metadata, stale data, missing fields, irrelevant service type, poor coverage, or only indirect relationship to the user’s question. Suggest what kind of source, field, record, or search direction would be needed to answer more reliably.

For follow-up questions, reuse provided context, visible conversation history, and previously gathered search results before performing a new search. If the user asks about a result that was found but not shown, answer from the already gathered results when possible. Perform a new search only when the user changes the topic, changes the geography, asks for a broader or narrower scope, requests newer sources, explicitly asks to search again, or the existing results are insufficient.

The agent may use general domain knowledge to form hypotheses, suggest related research directions, or explain why a dataset might be worth investigating. Do not present unsourced background knowledge as fact. Facts must be supported by provided records, dataset metadata, tool results, cited sources, or explicit logical reasoning. If a claim matters to the conclusion and is not already supported, state that it should be verified with an authoritative source.

Be especially careful with property, zoning, code, legal, compliance, and buildability questions. Do not state that a parcel is buildable, a use is permitted, a design is code-compliant, a risk is absent, or a requirement is satisfied unless the provided data directly supports that conclusion. When information is incomplete, say what is missing and what would be needed to answer reliably.

Write primarily in concise paragraphs rather than long lists. Avoid over-structuring the response. Use compact dataset recommendation paragraphs when showing recommended sources, and avoid displaying large result inventories unless the user asks for them. The response should synthesize findings, explain reasoning, identify uncertainty, and recommend useful next steps without unnecessary formatting.

A strong answer should generally explain what the data says, what is missing, what the data may imply, what related concepts or sources may be relevant, whether a search was performed or not, which results are recommended, and why those results are or are not sufficient. Do not expose internal routing, hidden reasoning, or implementation details unless the user asks about the system design.
```
