# Code Style

## React Structure

- Prefer functional React components for UI structure.
- Area files such as `SidebarArea.tsx`, `EditorArea.tsx`, and `AgentArea.tsx` should read as component composition first.
- Use `Fragment` imported from React instead of fragment shorthand `<>...</>`.
- Compatibility code that still uses imperative DOM/controller behavior must be isolated behind clearly named functions and treated as temporary migration code.
- Do not let large imperative setup blocks become the dominant shape of a React component file. Move them toward feature-owned hooks, components, or plain utility functions as soon as the ownership is clear.

## Function Parameters

- Keep function parameters on one line when they fit.
- Do not split ordinary parameter lists into one parameter per line for style alone.
- Use multi-line parameters only when the signature would become hard to read, such as destructured config objects with several typed fields.

## Imports

- Avoid duplicating feature registries manually.
- Prefer deriving feature-specific paths from a feature id when the file structure is conventional.
- Keep old compatibility files suffixed with `OLD`, and do not import them from the live app flow.
