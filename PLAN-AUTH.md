## Auth and User Data Plan

### Direction

Move app data out of `public/data` and into per-user, server-owned storage. Treat the JSON files as seed data only. After sign-in, each user gets private copies of agents, datasets, search sources, overlays, map state, folders, and workspace settings.

### Auth

Use a standard Next.js auth layer with:

- Google OAuth
- Microsoft OAuth
- Email magic link or passwordless code

Store users, accounts, sessions, and connected-provider tokens in a database. Keep provider access tokens encrypted at rest.

### Data Model

Start with these tables:

- `users`
- `accounts`
- `workspaces`
- `workspace_members`
- `workspace_records`
- `workspace_sources`
- `workspace_agents`
- `workspace_files`
- `connected_apps`

Each existing JSON registry becomes a workspace-scoped table row or JSON document.

### Connectors

Use direct OAuth integrations for core file/data providers that need durable access, especially Google Drive and Microsoft OneDrive/SharePoint. Use connectors where the user wants agent-accessible actions across external apps such as Notion, Miro, Discord, and BQE Core.

Recommendation: implement Google Drive directly first because folder mounting, file listing, and file permissions are core product behavior. Add a connector abstraction around it so future providers share the same shape.

### Migration Steps

1. Add auth and database schema.
2. On first login, seed a default workspace from `public/data`.
3. Replace write APIs so they read/write workspace-scoped user data.
4. Add connected-app token storage and refresh handling.
5. Move Browser Drive metadata under the active workspace.
6. Add admin/export tools before removing JSON-file writes.

### Security Notes

Never expose provider tokens to the browser. Route all provider API calls through server handlers. Keep API keys, OAuth refresh tokens, and connector credentials encrypted and scoped to the owning user or workspace.
