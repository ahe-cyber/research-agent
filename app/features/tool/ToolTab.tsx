import { useEffect, useState } from "react";
import { withBasePath } from "../../../lib/basePath";
import { SidebarCard } from "../../components/workspace/SidebarCard";

interface ToolParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Tool {
  name: string;
  description: string;
  params: ToolParam[];
}

interface ToolDeclaration {
  name: string;
  description: string;
  parameters?: {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

interface ToolTabProps {
  active: boolean;
  onSuggestTool?: (name: string) => void;
  onOpenPage?: (id: string, label: string) => void;
}

export function ToolTab({ active, onSuggestTool, onOpenPage }: ToolTabProps) {
  const [tools, setTools] = useState<Tool[]>([]);

  useEffect(() => {
    fetch(withBasePath("/api/tool"))
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ToolDeclaration[]) => setTools(normalizeToolDeclarations(data)))
      .catch(() => {});
  }, []);

  return (
    <section
      className={`workspace-tab${active ? " is-active" : ""}`}
      id="toolTab"
      data-tab-panel
      hidden={!active}
    >
      <h2 className="section-title">Tool</h2>
      <div className="tool-list">
        {tools.map((tool) => (
          <SidebarCard
            key={tool.name}
            className="tool-item tool-card"
            ariaLabel={tool.name}
            openLabel={`Open ${tool.name}`}
            onOpen={() => onOpenPage?.(`tool-${tool.name}`, tool.name)}
          >
            <button
              className="card-attach-button"
              type="button"
              aria-label={`Suggest ${tool.name} to agent`}
              title={`Suggest ${tool.name} to agent`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSuggestTool?.(tool.name);
              }}
            />
            <div className="tool-signature">
              <code className="tool-name">{tool.name}</code>
              {tool.params.length > 0 ? (
                <>
                  <span className="tool-paren">(</span>
                  {tool.params.map((param, i) => (
                    <span key={param.name}>
                      <span
                        className="tool-param"
                        title={`${param.type} — ${param.description}`}
                      >
                        {param.required ? param.name : `${param.name}?`}
                      </span>
                      {i < tool.params.length - 1 && (
                        <span className="tool-paren">, </span>
                      )}
                    </span>
                  ))}
                  <span className="tool-paren">)</span>
                </>
              ) : (
                <span className="tool-paren">()</span>
              )}
            </div>
            <p className="tool-card-description">{tool.description}</p>
          </SidebarCard>
        ))}
      </div>
    </section>
  );
}

function normalizeToolDeclarations(declarations: ToolDeclaration[]): Tool[] {
  if (!Array.isArray(declarations)) return [];
  return declarations.map(({ name, description, parameters }) => {
    const props = parameters?.properties ?? {};
    const required = parameters?.required ?? [];
    const params = Object.entries(props).map(([pname, pdef]) => ({
      name: pname,
      type: (pdef.type ?? "string").toLowerCase(),
      required: required.includes(pname),
      description: pdef.description ?? ""
    }));
    return { name, description, params };
  });
}
