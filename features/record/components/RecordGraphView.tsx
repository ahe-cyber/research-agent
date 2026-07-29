"use client";

import { useEffect, useRef, useState } from "react";
import {
  Background,
  Handle,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useNodeId,
  useUpdateNodeInternals,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { renderJsonTree } from "./RecordEditorRuntime";

interface RecordGraphViewProps {
  record: Record<string, any>;
  editorTabController?: any;
  onToggleGeoJson?: (record: Record<string, any>) => void;
}

type GraphNodeData = {
  label: string;
  detail?: string;
  value?: any;
  record: Record<string, any>;
  rootPath: string;
  editorTabController?: any;
  onToggleGeoJson?: (record: Record<string, any>) => void;
  expanded?: boolean;
  wrapped?: boolean;
};

type GraphNode = Node<GraphNodeData>;

const NODE_WIDTH = 220;
const X_GAP = 300;
const Y_GAP = 96;

export function RecordGraphView({ record, editorTabController, onToggleGeoJson }: RecordGraphViewProps) {
  const graph = buildRecordGraph(record, editorTabController, onToggleGeoJson);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  return (
    <div className="record-graph-panel">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(connection: Connection) => {
          setEdges((currentEdges) => addEdge({ ...connection, type: "smoothstep", animated: true }, currentEdges));
        }}
        onNodeClick={(event, node) => {
          const target = event.target as HTMLElement;
          if (target.closest(".record-graph-json")) return;

          setNodes((currentNodes) => currentNodes.map((item) => (
            item.id === node.id
              ? toggleNodeExpansion(item)
              : item
          )));
        }}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
      >
        <Background gap={24} size={1} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

const nodeTypes = {
  recordNode: RecordGraphNode,
};

function RecordGraphNode({ data }: NodeProps<GraphNode>) {
  const jsonContainerRef = useRef<HTMLDivElement | null>(null);
  const expandedPathsRef = useRef<Set<string>>(new Set());
  const [wrapped, setWrapped] = useState(false);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    const container = jsonContainerRef.current;
    if (!container || !data.expanded) return;

    container.replaceChildren(renderJsonTree(
      data.value,
      data.record,
      data.onToggleGeoJson || (() => {}),
      data.editorTabController,
      expandedPathsRef.current,
      data.label,
      data.rootPath,
    ));

    if (nodeId) {
      requestAnimationFrame(() => updateNodeInternals(nodeId));
    }
  }, [data.editorTabController, data.expanded, data.label, data.onToggleGeoJson, data.record, data.rootPath, data.value, wrapped]);

  return (
    <div className={`record-graph-node${data.expanded ? " is-expanded" : ""}${wrapped ? " is-json-text-wrapped" : ""}`}>
      <Handle className="record-graph-handle" id="target" type="target" position={Position.Left} />
      <div className="record-graph-header">
        <div className="record-graph-summary">
          <strong>{data.label}</strong>
          {data.detail ? <span>{data.detail}</span> : null}
        </div>
        <button
          className={`record-graph-wrap-button nodrag${wrapped ? " is-active" : ""}`}
          type="button"
          aria-pressed={wrapped}
          aria-label="Wrap text"
          title="Wrap text"
          onClick={(event) => {
            event.stopPropagation();
            setWrapped((value) => !value);
          }}
        />
      </div>
      {data.expanded ? (
        <div
          className="record-graph-json nowheel nodrag"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onWheelCapture={(event) => event.stopPropagation()}
        >
          <div ref={jsonContainerRef} />
        </div>
      ) : null}
      <Handle className="record-graph-handle" id="source" type="source" position={Position.Right} />
    </div>
  );
}

function toggleNodeExpansion(node: GraphNode): GraphNode {
  const nextExpanded = !node.data.expanded;

  return {
    ...node,
    data: {
      ...node.data,
      expanded: nextExpanded,
    },
  };
}

function buildRecordGraph(
  record: Record<string, any>,
  editorTabController: any,
  onToggleGeoJson?: (record: Record<string, any>) => void,
): { nodes: GraphNode[]; edges: Edge[] } {
  const nodes: GraphNode[] = [];
  const edges: Edge[] = [];
  const payload = record.payload;
  let childIndex = 0;

  addNode(nodes, "record", record.title || record.kind || "Record", record.kind || "Record", record, "record", record, editorTabController, onToggleGeoJson, 0, 0);

  if (payload && typeof payload === "object") {
    addConnectedNode(nodes, edges, "record", "payload", "Payload", summarizeValue(payload), payload, "payload", record, editorTabController, onToggleGeoJson, 1, childIndex++);
  }

  Object.entries(payload?.outputVariables || {}).forEach(([name, value]) => {
    addConnectedNode(nodes, edges, "payload", `output-${name}`, name, summarizeOutput(value), value, `outputVariables.${name}`, record, editorTabController, onToggleGeoJson, 2, childIndex++);
  });

  const pdfUrls = Array.isArray(payload?.pdfUrls) ? payload.pdfUrls : [];
  pdfUrls.forEach((item: any, index: number) => {
    addConnectedNode(nodes, edges, "payload", `pdf-${index}`, item.label || "PDF", item.url || "", item, `pdfUrls.${index}`, record, editorTabController, onToggleGeoJson, 2, childIndex++);
  });

  if (record.geojson || hasGeoJson(payload)) {
    addConnectedNode(nodes, edges, "payload", "geojson", "GeoJSON", summarizeValue(record.geojson || payload), record.geojson || payload, "geojson", record, editorTabController, onToggleGeoJson, 2, childIndex++);
  }

  if (payload?.request) {
    addConnectedNode(nodes, edges, "payload", "request", "Request", summarizeValue(payload.request), payload.request, "request", record, editorTabController, onToggleGeoJson, 2, childIndex++);
  }

  if (payload?.response) {
    addConnectedNode(nodes, edges, "payload", "response", "Response", summarizeValue(payload.response), payload.response, "response", record, editorTabController, onToggleGeoJson, 2, childIndex++);
  }

  if (nodes.length === 1) {
    addConnectedNode(nodes, edges, "record", "empty", "No relationships", "Open JSON for full record details.", null, "empty", record, editorTabController, onToggleGeoJson, 1, 0);
  }

  return { nodes, edges };
}

function addConnectedNode(
  nodes: GraphNode[],
  edges: Edge[],
  source: string,
  id: string,
  label: string,
  detail: string,
  value: any,
  jsonPath: string,
  record: Record<string, any>,
  editorTabController: any,
  onToggleGeoJson: ((record: Record<string, any>) => void) | undefined,
  column: number,
  row: number,
) {
  addNode(nodes, id, label, detail, value, jsonPath, record, editorTabController, onToggleGeoJson, column, row);
  edges.push({
    id: `${source}-${id}`,
    source,
    sourceHandle: "source",
    target: id,
    targetHandle: "target",
    type: "smoothstep",
    animated: true,
  });
}

function addNode(
  nodes: GraphNode[],
  id: string,
  label: string,
  detail: string,
  value: any,
  jsonPath: string,
  record: Record<string, any>,
  editorTabController: any,
  onToggleGeoJson: ((record: Record<string, any>) => void) | undefined,
  column: number,
  row: number,
) {
  nodes.push({
    id,
    type: "recordNode",
    position: {
      x: column * X_GAP,
      y: row * Y_GAP,
    },
    data: {
      label,
      detail,
      value,
      record,
      rootPath: `${record.id}.${jsonPath}`,
      editorTabController,
      onToggleGeoJson,
      expanded: false,
      wrapped: false,
    },
    style: {
      width: NODE_WIDTH,
      border: "1px solid #d6d9de",
      borderRadius: 6,
      background: "#ffffff",
      color: "#1f2933",
      fontSize: 12,
      padding: 10,
    },
  });
}

function summarizeOutput(value: any): string {
  if (value?.tag) return `<${value.tag}>`;
  return summarizeValue(value);
}

function summarizeValue(value: any): string {
  if (Array.isArray(value)) return `${value.length} items`;
  if (value && typeof value === "object") return `${Object.keys(value).length} fields`;
  return String(value ?? "");
}

function hasGeoJson(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  if (["Feature", "FeatureCollection", "Point", "LineString", "Polygon", "MultiPolygon"].includes(value.type)) return true;
  return Object.values(value).some(hasGeoJson);
}
