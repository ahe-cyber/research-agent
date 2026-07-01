# Agentic AEC IDE

The project is an **Agentic AEC IDE**: a visual, extensible environment where AI agents, tools, skills, MCP servers, project data, and human workflows come together to support architectural work across research, schematic design, filing, reporting, presentations, estimating, and project management.

## Overview

The current implementation is intentionally simple. It is an early GIS and data-research workspace for searching addresses and places, inspecting records, running source queries, viewing map results, and using attached records for AI-assisted analysis. The interface is designed to feel closer to an editor than a single-purpose map page, with a narrow feature rail, a left workspace sidebar, a central editor, and a right agent sidebar.

Current capabilities include:

* Configurable address and place search sources, including NYC GeoSearch, Mapbox Search, and Google Places.
* Registry-backed dataset source editors.
* Manual dataset queries through a server-side proxy API.
* In-memory query records with request, response, timing, and extracted output variables.
* Expandable JSON response trees.
* GeoJSON polygon visibility toggles on the map.
* PDF and image link extraction into the Folder tab.
* An AI agent panel that can use attached query records as context for analysis.

## User Stories

Use this section to capture the product narrative before translating it into implementation tasks.

### Story Outline

#### Wagner College Zoning Lot and Floor Area Research

1. **Who is the user?**
   * Primary role: Architect or zoning researcher evaluating an institutional campus.
   * Secondary roles: Project lead, planner, reviewer, or analyst preparing a zoning due diligence report.
   * Team or project context: The team is studying Wagner College, a large campus with multiple tax lots that may function as one zoning lot.

2. **What situation are they in?**
   * Project type: Existing college campus / institutional site research.
   * Starting material: The user begins with the place name `wagner college`, not a single BBL or known zoning lot boundary.
   * Urgency or constraint: The team needs zoning lot area and zoning floor area, but the readily available datasets do not directly provide a complete zoning lot outline or official per-building zoning floor area.
   * What is hard about the current workflow: Address search lands on one larger building within the campus instead of the whole campus; tax lots, buildings, zoning districts, and zoning lot assumptions need to be compared interactively; building-level floor area and floor counts are incomplete or distributed across different public records.

3. **What are they trying to accomplish?**
   * Main goal: Determine the best-supported zoning lot area and zoning floor area for the campus.
   * Supporting goals: Identify each relevant tax lot, inspect each building footprint, review available official floor area fields, estimate or explain gaps in per-building breakdowns, and understand how the buildings relate to the larger campus.
   * Decisions they need to make: Which tax lots should be treated as part of the zoning lot, which public records can support the analysis, and where assumptions or manual verification are required.
   * Deliverables they need to produce: A research report that states the findings, cites the datasets used, and clearly explains limitations in the available data.

4. **What do they do in the workspace?**
   * Search: Enter `wagner college` in the Address search bar and compare provider results from NYC GeoSearch, Mapbox Search, and Google Places.
   * Map: Navigate to the campus, see tax lots, building footprints, zoning district context, and ideally photorealistic 3D buildings.
   * Records: Query and inspect MAPPLUTO, building footprints, zoning GIS data, and any available building/elevation/floor-area sources.
   * Folder/files: Attach supporting PDFs, drawings, or exported records if the team has private due diligence material.
   * Agent: Ask the AI to synthesize the records, calculate or summarize known areas, identify missing information, and distinguish official values from inferred or unavailable values.
   * Output/report: Generate a report explaining the target zoning question, the datasets reviewed, the calculated or observed values, and the limitations caused by unavailable zoning lot boundaries or per-building zoning floor area.

5. **What does success look like?**
   * Faster because: The user can start from a campus name and move directly into mapped records instead of manually searching separate GIS portals.
   * More accurate because: Tax lots, building footprints, zoning data, and source records stay visible and inspectable together.
   * Easier to explain because: The report separates confirmed public data from assumptions, estimates, and missing official records.
   * Reusable later because: The records, map layers, and report remain attached to the project for later review or refinement.

1. **Who is the user?**
   * Primary role:
   * Secondary roles:
   * Team or project context:

2. **What situation are they in?**
   * Project type:
   * Starting material:
   * Urgency or constraint:
   * What is hard about the current workflow:

3. **What are they trying to accomplish?**
   * Main goal:
   * Supporting goals:
   * Decisions they need to make:
   * Deliverables they need to produce:

4. **What do they do in the workspace?**
   * Search:
   * Map:
   * Records:
   * Folder/files:
   * Agent:
   * Output/report:

5. **What does success look like?**
   * Faster because:
   * More accurate because:
   * Easier to explain because:
   * Reusable later because:

### User Story Template

```text
As a [user or role],
I want to [action or workflow],
so that [outcome or value].
```

### Acceptance Criteria Template

```text
Given [starting context],
when [user action],
then [observable result].
```

## Engineering Conventions

The project is migrating incrementally to Next.js. New code should follow the intended architecture even while legacy modules remain in place:

* Favor Next.js App Router structure and React components for new UI work.
* Prefer `.tsx` for components and `.ts` for application logic. Add new `.js` or `.jsx` files only when touching a legacy boundary makes that unavoidable.
* Keep feature-specific code under `features/*`, reusable UI components under an appropriate shared feature folder, and route handlers under `app/api/*`.
* Prefer data-driven behavior over hard-coded configuration. The current registries are JSON files under `public/data`.
* Extract reusable components when multiple editor pages share layout or interaction patterns, especially menus, list views, table views, graph views, cards, and action rows.
* Keep each migration increment buildable. Avoid combining broad file moves, visual redesigns, and behavior changes unless they belong to the same focused task.

Feature nomenclature must stay absolutely consistent. Use the canonical singular feature ids from `public/data/feature.json` everywhere a feature identity appears: `project`, `folder`, `address`, `record`, `dataset`, `tool`, `agent`, and `map`. Folder names, filenames, exported component names, controller/function names, CSS namespace roots, route folders, object keys, and object values should use the same singular feature word when they refer to that feature. Do not reintroduce plural or legacy aliases such as `agents`, `datasets`, `tools`, `sources`, `assets`, `records`, `details`, or `formulas` for feature-owned code.

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
Feature rail → Workspace sidebar → Map editor → Agent sidebar
```

## Feature Tabs

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

### TODO:
- [ ] allow more agent only options for modifying map and persist map state
- [ ] implement workspace logic
- [ ] Add Multimodal RAG for Building Codes, Drawings, and Models
- [ ] Migrate CSS to SCSS
- [ ] Add other options for terrain and 3d
  https://developers.google.com/maps/documentation/javascript/webgl/webgl-overlay-view
  https://developers.google.com/maps/documentation/javascript/reference/3d-map
  https://developers.google.com/maps/documentation/tile/3d-tiles-overview
  https://gis.ny.gov/lidar
- [ ] Minor information for map layers: dataset last updated, dataset creation date, dataset descriptio
- [ ] allow interaction with map elements such as geometry, 3d geometry, elevation, etc. will also show selected value from individual datasets.

### Pending Assignment Plannings:

### Current Plannings:

### Pending Review Issues:

### Pending Assignment Issues:

### Current Issues:
- [x] this block should be removed "Mount a drive to browse PDF, DXF, and IFC files. Retrieved assets will also appear here."
- [x] the mount and unmount svgs are not satisfactory. use this :![alt text](image-13.png) for unmount, and ![alt text](image-11.png) for mount. redraw them in svg.
- [x] after mounting, the panel should show the file system. not just showing available files.
- [x] I asked many times that things be data driven such as this

```jsx
    <section
      className={`workspace-tab${active ? " is-active" : ""}`}
      id="agentTab"
      data-tab-panel
      hidden={!active}
    >
      <div className="section-title-row">
        <h2 className="section-title">Agent</h2>
        <SourceDropdownSlot
          className="agent-provider-dropdown"
          options={AGENT_PROVIDER_OPTIONS.map((provider) => ({
            id: provider.id,
            label: provider.label,
            costly: Boolean(providerConfigs[provider.id]?.costly || providerConfigs[provider.id]?.apiKey)
          }))}
          selectedId={initialProviderId}
          onChange={(provider) => {
            const providerId = provider?.id || "gemini";
            localStorage.setItem(AGENT_PROVIDER_STORAGE_KEY, providerId);
            window.dispatchEvent(new CustomEvent("research-agent:agent-provider-changed", {
              detail: { providerId }
            }));
          }}
          onEdit={() => window.dispatchEvent(new CustomEvent("research-agent:edit-agent-providers"))}
          editLabel="Edit agent sources"
        />
      </div>
      <div className="agent-model-search-widget" id="agentSidebarModelSearch" ref={modelSearchRef} />
      <div id="agentCompact" />
    </section>
```
it should become some new componenet resembling this. this component could just be the "SourceDropdownSlot" expanded to include more elements.
```jsx
    <section
      className={`workspace-tab${active ? " is-active" : ""}`}
      id={featureName.lower() + "Tab"}
      data-tab-panel
      hidden={!active}
    >
      <div className="section-title-row">
        <h2 className="section-title">{featureName.proper()}</h2>
        <SourceDropdownSlot
          className="agent-provider-dropdown"
          options={PROVIDER_OPTIONS.map((provider) => ({
            id: provider.id,
            label: provider.label,
            costly: Boolean(providerConfigs[provider.id]?.costly || providerConfigs[provider.id]?.apiKey)
          }))}
          selectedId={initialProviderId}
          onChange={(provider) => {
            const providerId = provider?.id || "gemini";
            localStorage.setItem(AGENT_PROVIDER_STORAGE_KEY, providerId);
            window.dispatchEvent(new CustomEvent({"research-agent:" + featureName.lower() + "-provider-changed"}, {
              detail: { providerId }
            }));
          }}
          onEdit={() => window.dispatchEvent(new CustomEvent({"research-agent:edit-" + featureName.lower() + "-providers"}))}
          editLabel={"Edit " + featureName.lower() + " sources"}
        />
      </div>
      <div className={featureName.lower() + "-search-widget"} id={featureName.lower() + "SidebarSearch"} ref={searchRef} />
      <div id={featureName.lower() + "Compact"} />
    </section>
```
it was very annoying seeing for address ![alt text](image-14.png) with the costly icon on the selector ![alt text](image-15.png), no costly in the edit page. ![alt text](image-16.png) ![alt text](image-17.png). so many inconsistencies. do you just keep ignoring my request to make common components or what.

# Six-World Semantic Model for Architectural Design

Architecture is analyzed through six complementary semantic worlds. These worlds are not mutually exclusive; they are different perspectives used to describe the same site, building, drawing, design proposal, or urban condition.

## Dataworld

Represents measurable physical, spatial, environmental, financial, and regulatory properties.

Examples: lot area, FAR, building height, setbacks, floor area, room area, corridor width, travel distance, occupant load, stair width, structural span, daylight level, solar exposure, slope, flood elevation, noise level, EUI, embodied carbon, cost per square foot.

## Logiworld

Represents the conceptual architectural objects present in the project.

Examples: site, parcel, street, sidewalk, wall, slab, column, beam, core, stair, elevator, corridor, lobby, room, unit, courtyard, atrium, terrace, roof, facade, window, door, zoning district, occupancy group, exit, fire separation, accessible route.

## Archiworld

Represents relationships, systems, sequences, and constraints between architectural objects.

Examples: entry sequence, public-to-private gradient, circulation loop, threshold, spatial hierarchy, served/servant relationship, front/back condition, solid/void rhythm, compression/release, view corridor, program adjacency, structural grid, core organization, egress path, fire separation relationship, setback envelope, height plane, FAR tradeoff, massing transition, phasing dependency, code conflict, zoning opportunity.

## Lifeworld

Represents direct perceptual and embodied qualities of architecture: how a place is experienced by the body and senses.

Examples: open, compressed, narrow, wide, tall, low, airy, heavy, light, warm, cold, soft, harsh, bright, dim, shadowy, glare-prone, quiet, echoic, smooth, rough, porous, enclosed, deep, shallow, legible, disorienting, accessible, fatiguing, crowded, exposed, protected.

## Dreamworld

Represents the symbolic, atmospheric, or imaginative world evoked by architecture.

Examples: sacred, monastic, eerie, ruinous, subterranean, celestial, oceanic, elemental, haunted, utopian, dystopian, nostalgic, ceremonial, mysterious, bunker-like, cave-like, forest-like, machine-dream, abandoned, mythic, otherworldly.

## Fictiworld

Represents shared architectural meanings, typologies, styles, precedents, institutions, narratives, and disciplinary conventions.

Examples: courtyard house, rowhouse, brownstone, loft building, perimeter block, tower-on-podium, mat building, museum, gallery, black-box theater, white-cube gallery, warehouse conversion, campus building, Brutalist, Minimalist, High-tech, Postmodern, Vernacular, Parametric, adaptive reuse, landmark-sensitive intervention, as-of-right development, public-review project, code-minimum solution, sustainability certification, developer pro forma logic, urban lantern, vertical village, interior street, civic condenser.

The analyzer produces descriptors in each world with confidence values, evidence, assumptions, and source references. These descriptors can then support precedent retrieval, zoning/code reasoning, diagram generation, report writing, design critique, and presentation asset selection.
