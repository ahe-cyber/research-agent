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
│   # Route files stay thin: bind HTTP verbs to named feature/server or lib/server functions.
│   # Use request body or URL parameters for more detailed feature control.
│   # Avoid top-level technical routes such as /api/data, /api/proxy, /api/overlay, or /api/geometry.
│   # Mount behavior under the owning feature, e.g. /api/map?resource=geometry or /api/address.
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
│   │   ├── client/
│   │   │   └── api.ts                       # Browser calls to the feature API
│   │   │
│   │   ├── server/
│   │   │   ├── handler.ts                   # HTTP request handling
│   │   │   ├── service.ts                   # Feature operations and logic
│   │   │   └── repository.ts                # Reads and writes feature-owned data
│   │   │
│   │   ├── shared/
│   │   │   ├── schemas.ts                   # Runtime validation
│   │   │   └── types.ts                     # Shared TypeScript types
│   │   │
│   │   ├── this-feature-types.d.ts
│   │   ├── this-feature-icon.svg
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
