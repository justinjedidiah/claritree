import { useState, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Panel,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { useFocusStore } from "../stores/useFocusStore";
import MetricNode from "./MetricNode";
import type { DashboardProps } from "../pages/Dashboard";
import { fetchData } from "../engine/graph";
import { CursorArrowRaysIcon, ArrowLeftIcon, ArrowRightIcon, SquaresPlusIcon  } from "@heroicons/react/24/outline";

const nodeTypes = {
  metric: MetricNode
};


// ---------- COMPONENT ----------
export default function FinanceGraph({ filters, isMobile }: { filters: DashboardProps; isMobile: boolean }) {
  // Special hooks for react flow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Hooks for react flow tool pane
  const [showModePanel, setShowModePanel] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);

  // Focus related
  const [selectionMode, setSelectionMode] = useState<'default' | 'with_descendants' | 'with_ancestors' | 'with_ancestors_and_descendants'>('default');
  const pushFocus = useFocusStore((s) => s.pushFocus);
  const clearFocus = useFocusStore((s) => s.clearCurrentFocus);
  const currentFocus = useFocusStore((s) => s.currentFocus);

  // Data fetch
  useEffect(() => {
    const load = async () => {
      const data = await fetchData(filters);
      setNodes(data.nodes);
      setEdges(data.edges);
    };
    load();
  },[filters]);

  const { adjacency, reverseAdjacency } = useMemo(() => {
    const adjacency = new Map<string, { target: string; edgeId: string }[]>();
    const reverseAdjacency = new Map<string, { source: string; edgeId: string }[]>();

    edges.forEach((edge) => {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source)!.push({ target: edge.target, edgeId: edge.id });

      if (!reverseAdjacency.has(edge.target)) reverseAdjacency.set(edge.target, []);
      reverseAdjacency.get(edge.target)!.push({ source: edge.source, edgeId: edge.id });
    });

    return { adjacency, reverseAdjacency };
  }, [edges]);

  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    const nodeSet = new Set<string>();
    const edgeSet = new Set<string>();

    if (currentFocus.length === 0) {
      return { connectedNodeIds: nodeSet, connectedEdgeIds: edgeSet };
    }

    currentFocus.forEach((focus) => {
      if (focus?.type !== "node") return;

      const traverse = (nodeId: string, map: Map<string, { target?: string; source?: string; edgeId: string }[]>, direction: 'target' | 'source') => {
        // tracks already-processed nodes to prevent infinite loops in cyclic graphs
        const visited = new Set<string>();
        // nodes queued for processing — start with the root node
        const stack = [nodeId];
        while (stack.length) {
          const current = stack.pop()!;
          const neighbors = map.get(current);
          if (!neighbors) continue;
          neighbors.forEach((n) => {
            const next = direction === 'target' ? n.target! : n.source!;
            if (!visited.has(next)) {
              visited.add(next);
              nodeSet.add(next);
              edgeSet.add(n.edgeId);
              stack.push(next);
            }
          });
        }
      };

      const mode = focus.mode ?? 'default';
      nodeSet.add(focus.id);
      if (mode === 'with_ancestors') traverse(focus.id, adjacency, 'target');
      else if (mode === 'with_descendants') traverse(focus.id, reverseAdjacency, 'source');
      else if (mode === 'with_ancestors_and_descendants') {
        traverse(focus.id, adjacency, 'target');
        traverse(focus.id, reverseAdjacency, 'source');
      }
      // default: no traversal
    });

    return { connectedNodeIds: nodeSet, connectedEdgeIds: edgeSet };
  }, [adjacency, reverseAdjacency, currentFocus]);

  const styledNodes = nodes.map((node) => {
    const isFocused =
      currentFocus.some(f => f.type === "node" && f.id === node.id);
      // currentFocus?.type === "node" &&
      // currentFocus.id === node.id;

    const isConnected = connectedNodeIds.has(node.id);

    const hasFocus = currentFocus.length > 0;
    const isDimmed =
      hasFocus &&
      !isFocused &&
      !isConnected;

    return {
      ...node,
      data: {
        ...node.data,
        isFocused,
        isConnected,
        isDimmed,
      },
    };
  });

  const styledEdges = edges.map((edge) => {
    const isFocused =
      currentFocus.some(f => f.type === "edge" && f.id === edge.id);
      // currentFocus?.type === "edge" &&
      // currentFocus.id === edge.id;

    const isConnected =
      // currentFocus?.type === "node" &&
      connectedEdgeIds.has(edge.id);

    const hasFocus = currentFocus.length > 0;

    const isDimmed =
      hasFocus &&
      !isFocused &&
      !isConnected;

    return {
      ...edge,
      animated: isFocused || isConnected,
      style: {
        ...edge.style,
        opacity: isDimmed ? 0.15 : 1,
        strokeWidth:
          isFocused ? 4 :
          isConnected ? 3 :
          2,
        filter:
          isFocused ? "drop-shadow(0 0 6px rgba(59,130,246,0.6))" : "none",
      },
    };
  });

  return (
    <ReactFlowProvider>
      <div className="h-full w-full bg-white rounded-xl">
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
          onNodeClick={(event, node) => {
            const isMultiSelect = multiSelect || event.ctrlKey || event.metaKey;
            pushFocus({ type: "node", id: node.id, mode: selectionMode }, isMultiSelect);
          }}

          onEdgeClick={(event, edge) => {
            const isMultiSelect = multiSelect || event.ctrlKey || event.metaKey;
            pushFocus({ type: "edge", id: edge.id, mode: selectionMode }, isMultiSelect);
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={clearFocus}
        >
          {!isMobile && (
            <MiniMap 
              position="bottom-left"
              pannable 
              zoomable
              // This makes the 'view area' rectangle stand out
              maskColor="rgba(255, 255, 255, 0.08)" 
              maskStrokeColor="#6366f1" // Gives the viewport box a blue border like an IDE
              maskStrokeWidth={4}
              style={{
                  backgroundColor: '#030712',
                  border: '1px solid #374151',
                  // VS Code minimaps are usually tall and thin
                  width: 120,
                  height: 180, 
              }}
            />
          )}
          <Controls />
          <Panel position="top-left">
            <div className="flex flex-col gap-1">
              {/* trigger button */}
              <button
                onClick={() => setShowModePanel(p => !p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border shadow-sm transition-colors ${
                  showModePanel
                    ? 'bg-indigo-500 text-white border-indigo-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                <CursorArrowRaysIcon className="w-4 h-4" />
                Selection Mode
              </button>

              {/* options — only shown when open */}
              {showModePanel && (
                <div className="flex flex-col gap-1 bg-white border border-gray-200 rounded-lg shadow-sm p-1.5">
                  {([
                    { value: 'default',                       label: 'Node only',              icon: '◉' },
                    { value: 'with_descendants',              label: 'Descendants',            icon: <ArrowRightIcon className="w-4 h-4" /> },
                    { value: 'with_ancestors',                label: 'Ancestors',              icon: <ArrowLeftIcon className="w-4 h-4" /> },
                    { value: 'with_ancestors_and_descendants', label: 'Ancestors & Descendants', icon: '⬕' },
                  ] as const).map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => { setSelectionMode(value); setShowModePanel(false); }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        selectionMode === value
                          ? 'bg-indigo-500 text-white'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <span>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setMultiSelect(p => !p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border shadow-sm transition-colors ${
                  multiSelect
                    ? 'bg-indigo-500 text-white border-indigo-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                <SquaresPlusIcon className="w-4 h-4" />
                Multi Select
              </button>
            </div>
          </Panel>
          <Background gap={20} size={1} color="#374151" />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
