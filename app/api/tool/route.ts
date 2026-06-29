import { jsonResponse } from "../_lib/files";

export const TOOL_DECLARATIONS = [
  {
    name: "list_catalogs",
    description: "List all configured GIS data catalogs. Call this before search_catalog to see which catalogs and URLs are available."
  },
  {
    name: "list_sources",
    description: "List all configured data sources (pre-built queries with known endpoints). Returns id, name, type, description, query URL, and default params for each."
  },
  {
    name: "query_source",
    description: "Execute one configured data source by id or name. Use list_sources first when you need available source ids. Provide params to override or add query parameters such as geometry, where, outFields, or limit.",
    parameters: {
      type: "OBJECT",
      properties: {
        sourceId: { type: "STRING", description: "Configured source id or exact/source display name from list_sources." },
        params: {
          type: "OBJECT",
          description: "Optional query parameter overrides. Values should be strings, numbers, or booleans.",
          additionalProperties: {
            anyOf: [{ type: "STRING" }, { type: "NUMBER" }, { type: "BOOLEAN" }]
          }
        }
      },
      required: ["sourceId"]
    }
  },
  {
    name: "list_agents",
    description: "List configured agents available for delegation. Returns id, name, instruction summary, attached direct collaborators, and suggested tools."
  },
  {
    name: "call_agent",
    description: "Call an agent directly by id or name. Use this to delegate a focused task to an attached or configured specialist agent and get its response. The result contains a `text` field with the agent's reply — always relay that text to the user verbatim or quoted.",
    parameters: {
      type: "OBJECT",
      properties: {
        agentId: { type: "STRING", description: "Agent id or exact name." },
        callerId: { type: "STRING", description: "Caller agent id." },
        message: { type: "STRING", description: "The task, question, or context to send to that agent." },
        blind: { type: "BOOLEAN", description: "When true, the call starts a fresh conversation with no history and the result is not saved. Use for one-off lookups that should not affect ongoing context." }
      },
      required: ["agentId", "callerId", "message"]
    }
  },
  {
    name: "create_agent",
    description: "Create a new agent with a name and optional instruction. Use this when the user asks to add or create a new agent.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Display name for the new agent." },
        description: { type: "STRING", description: "Optional system instruction / description for the agent." }
      },
      required: ["name"]
    }
  },
  {
    name: "edit_agent",
    description: "Edit a single agent's instruction by id or name. Call multiple times to edit multiple agents.",
    parameters: {
      type: "OBJECT",
      properties: {
        agentId: { type: "STRING", description: "Id or name of the agent to edit." },
        instruction: { type: "STRING", description: "Instruction text to apply." },
        mode: { type: "STRING", description: "Use replace to overwrite the instruction, or append to add to the current instruction. Defaults to replace." }
      },
      required: ["agentId", "instruction"]
    }
  },
  {
    name: "edit_communication",
    description: "Set or update the communication instruction on the connection from one agent to another. Describes how the sender should communicate with the receiver. Creates the connection if it does not exist.",
    parameters: {
      type: "OBJECT",
      properties: {
        senderId: { type: "STRING", description: "Id or name of the agent that sends." },
        receiverId: { type: "STRING", description: "Id or name of the agent that receives." },
        instruction: { type: "STRING", description: "Communication instruction for this direction." }
      },
      required: ["senderId", "receiverId", "instruction"]
    }
  },
  {
    name: "search_catalog",
    description: "Search a GIS data catalog for datasets matching a query. Call list_catalogs first to get available catalog URLs.",
    parameters: {
      type: "OBJECT",
      properties: {
        query:  { type: "STRING", description: "Search query terms" },
        catalogUrl: { type: "STRING", description: "Catalog base URL from list_catalogs" },
        bbox:   { type: "STRING", description: "Optional bounding box as 'minLng,minLat,maxLng,maxLat' for spatial filtering" }
      },
      required: ["query", "catalogUrl"]
    }
  },
  {
    name: "get_report",
    description: "Get the current content of the research report for the active property."
  },
  {
    name: "update_report",
    description: "Create, append to, or replace a section of the research report. Use this for property data, zoning info, ownership details, and key findings. Prefer replacing or appending to an existing section when report_status shows a matching heading. Use append only when adding genuinely new material. You must call this tool before telling the user that you added, saved, wrote, or updated report content. Keep chat conversational — save structure for the report.",
    parameters: {
      type: "OBJECT",
      properties: {
        content: { type: "STRING", description: "Markdown content for the section. May be empty only when intentionally creating a heading-only section." },
        heading: { type: "STRING", description: "Optional section heading to create, append to, or replace." },
        mode: { type: "STRING", description: "append, append_to_section, or replace_section. Defaults to replace_section when heading is provided, otherwise append." },
        sectionIndex: { type: "NUMBER", description: "Optional zero-based index from report_status.outline when duplicate headings exist." }
      }
    }
  }
];

export async function GET() {
  return jsonResponse(TOOL_DECLARATIONS);
}
