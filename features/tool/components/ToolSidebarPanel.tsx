import { useEffect, useState } from "react";
import { SidebarCard } from "@/components/sidebar/SidebarCard";
import { SidebarPanel } from "@/components/sidebar/SidebarPanel";
import type { Tool, ToolDeclaration } from "../tool.schema";
import { getToolDeclarations } from "../tool.api";

interface ToolSidebarPanelProps {
  active: boolean;
  onOpenPage?: (id: string, label: string, value: Tool) => void;
}

export function ToolSidebarPanel({ active, onOpenPage }: ToolSidebarPanelProps) {
  const [tools, setTools] = useState<Tool[]>([]);

  useEffect(() => {
    getToolDeclarations()
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ToolDeclaration[]) => setTools(normalizeToolDeclarations(data)))
      .catch(() => {});
  }, []);

  return (
    <SidebarPanel
      active={active}
      featureId="tool"
      featureLabel="Tool"
    >
      <div className="tool-list">
        {tools.map((tool) => (
          <SidebarCard
            key={tool.name}
            className="tool-item tool-card"
            ariaLabel={tool.name}
            openLabel={`Open ${tool.name}`}
            onOpen={() => onOpenPage?.(`tool-${tool.name}`, tool.name, tool)}
          >
            <div className="tool-signature">
              <code className="tool-name">{tool.name}</code>
              {tool.params.length > 0 ? (
                <>
                  <span className="tool-paren">(</span>
                  {tool.params.map((param, i) => (
                    <span key={param.name}>
                      <span
                        className="tool-param"
                        title={`${param.type} - ${param.description}`}
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
    </SidebarPanel>
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
