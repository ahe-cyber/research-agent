```tree
research-agent/
├── app/
│   ├── api/
│   │   ├── this-feature/
│   │   │   └── route.ts                     # Only API route for this feature
│   │   ├── another-feature/
│   │   │   └── route.ts
│   │   └── ...
│   │
│   ├── globals.css                          # Global styles and shared variables
│   ├── global.d.ts                          # App-wide global type declarations
│   ├── layout.tsx                           # Root HTML and global setup
│   └── page.tsx                             # Main application entry
│
│   # Each feature in app/api has exactly one route.ts with one set of HTTP methods.
│   # Route files stay thin: import HTTP verbs from features/<feature>/server/handler.ts.
│   # Use request body or URL parameters for more detailed feature control.
│   # Avoid top-level technical routes such as /api/data, /api/proxy, /api/overlay, or /api/geometry.
│   # Mount behavior under the owning feature, e.g. /api/map?resource=geometry or /api/address.
│   # Frontend code calls feature APIs through features/<feature>/<feature>.api.ts.
│   # Server handlers parse request params/body, services own operations, and repositories own data access.
│   # Provider-specific code lives in features/<feature>/providers/<provider>.ts.
│   # Put client-facing provider metadata and browser functions first, then separate server-only functions with a comment.
│   # Services import provider server functions when feature behavior depends on a provider-specific implementation.
│   # Map providers include map behavior/source owners such as PDF overlays, GeoJSON, drawn geometries, terrain, basemaps, and scene layers.
│   # Feature schemas live at features/<feature>/<feature>.schema.ts, use Zod, and export inferred types.
│   # Feature endpoint URLs and source configuration belong in data/search.json or feature data files, not constants in server handlers.
│
├── components/
│   ├── Application.tsx                      # Main interactive application
│   ├── Application.module.css
│   │
│   ├── sidebar/
│   │   ├── OneSidebarComponent.tsx
│   │   ├── AnotherSidebarComponent.tsx
│   │   ├── ...
│   │   └── Sidebar.module.css
│   │
│   ├── editor/
│   │   ├── OneEditorComponent.tsx
│   │   ├── AnotherEditorComponent.tsx
│   │   ├── ...
│   │   └── Editor.module.css
│   │
│   └── primitives/
│       ├── OnePrimitiveComponent.tsx
│       ├── AnotherPrimitiveComponent.tsx
│       ├── ...
│       └── Primitives.module.css
│
├── features/
│   ├── this-feature/
│   │   ├── components/
│   │   │   ├── ThisFeatureSidebar.tsx
│   │   │   ├── ThisFeatureMenu.tsx
│   │   │   ├── ThisFeatureCard.tsx
│   │   │   ├── ThisFeatureEditor.tsx
│   │   │   └── ...
│   │   │
│   │   ├── providers/
│   │   │   ├── one-provider.ts             # Client provider exports first, then server provider exports
│   │   │   ├── another-provider.ts
│   │   │   └── ...
│   │   │
│   │   ├── server/
│   │   │   ├── handler.ts                   # HTTP request handling
│   │   │   ├── service.ts                   # Feature operations and logic
│   │   │   └── repository.ts                # Reads and writes feature-owned data
│   │   │
│   │   ├── this-feature.api.ts              # Browser calls to the feature API
│   │   ├── this-feature.schema.ts           # Zod schemas and inferred types
│   │   ├── this-feature.icon.svg 
│   │   └── this-feature.module.css
│   │
│   ├── another-feature/
│   │   └── ...
│   │
│   └── ...
│
├── data/
│   ├── feature.json                         # Available feature definitions
│   ├── documents.json                       # Available document definitions
│   ├── search-sources.json                  # Search sources assigned to features
│   │
│   ├── features/
│   │   ├── this-feature.json                # Mutable data for one feature
│   │   ├── another-feature.json
│   │   └── ...
│   │
│   └── documents/
│       ├── <pdf-document-id>/
│       │   ├── metadata.json                # Document identity and page definitions
│       │   ├── placement.json               # Placement and rendering state
│       │   ├── source.pdf                   # Original uploaded PDF
│       │   └── pages/
│       │       ├── page-001.png             # Generated page image
│       │       ├── page-002.png
│       │       └── ...
│       │
│       ├── <geometry-document-id>/
│       │   ├── metadata.json                # Geometry identity and origin
│       │   ├── geometry.json                # Layers, geometries, and coordinates
│       │   └── source.geojson               # Optional imported source
│       │
│       ├── <image-document-id>/
│       │   ├── metadata.json
│       │   ├── placement.json
│       │   └── source.png
│       │
│       ├── <another-document-id>/
│       │   ├── metadata.json
│       │   └── ...
│       │
│       └── ...
│
├── lib/
│   ├── client/                              # Shared browser-only utilities
│   └── server/                              # Shared server-only utilities
│
├── public/                                  # Static files served directly by URL
│
├── next.config.ts
├── package.json
└── tsconfig.json                            # Defines @/* project-root imports
```
