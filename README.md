# Research Agent

The project is an **Agentic AEC IDE**: a visual, extensible environment where AI agents, tools, skills, MCP servers, project data, and human workflows come together to support architectural work across research, schematic design, filing, reporting, presentations, estimating, and project management.

Latest version: `v0.0.6`

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
- [ ] Add other options for terrain and 3d
    https://developers.google.com/maps/documentation/javascript/webgl/webgl-overlay-view
    https://developers.google.com/maps/documentation/javascript/reference/3d-map
    https://developers.google.com/maps/documentation/tile/3d-tiles-overview
    https://gis.ny.gov/lidar
- [ ] Minor information for map layers: dataset last updated, dataset creation date, dataset descriptio
- [ ] allow interaction with map elements such as geometry, 3d geometry, elevation, etc. will also show selected value from individual datasets.

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
