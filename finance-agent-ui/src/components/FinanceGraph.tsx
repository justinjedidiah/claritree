import { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
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

const nodeTypes = {
  metric: MetricNode
};


// ---------- COMPONENT ----------
export default function FinanceGraph({ filters }: { filters: DashboardProps }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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

  const adjacency = useMemo(() => {
    const map = new Map<string, { target: string; edgeId: string }[]>();

    edges.forEach((edge) => {
      if (!map.has(edge.source)) {
        map.set(edge.source, []);
      }

      map.get(edge.source)!.push({
        target: edge.target,
        edgeId: edge.id,
      });
    });

    return map;
  }, [edges]);

  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    const nodeSet = new Set<string>();
    const edgeSet = new Set<string>();

    if (currentFocus.length === 0) {
      return { connectedNodeIds: nodeSet, connectedEdgeIds: edgeSet };
    }

    currentFocus.forEach((focus) => {
      if (focus?.type !== "node") return;

      const visited = new Set<string>();

      const traverse = (nodeId: string) => {
        const neighbors = adjacency.get(nodeId);
        if (!neighbors) return;

        neighbors.forEach(({ target, edgeId }) => {
          if (!visited.has(target)) {
            visited.add(target);

            nodeSet.add(target);
            edgeSet.add(edgeId);

            traverse(target);
          }
        });
      };

      nodeSet.add(focus.id);
      traverse(focus.id);
    });

    return { connectedNodeIds: nodeSet, connectedEdgeIds: edgeSet };
  }, [adjacency, currentFocus]);

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
            const isMultiSelect = event.ctrlKey || event.metaKey;
            pushFocus({ type: "node", id: node.id }, isMultiSelect);
          }}

          onEdgeClick={(event, edge) => {
            const isMultiSelect = event.ctrlKey || event.metaKey;
            pushFocus({ type: "edge", id: edge.id }, isMultiSelect);
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={clearFocus}
        >
          <MiniMap 
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
          <Controls />
          <Background gap={20} size={1} color="#374151" />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

// export default function FinanceGraph() {
//   return (
//     <ReactFlowProvider>
//       <FinanceGraphInner />
//     </ReactFlowProvider>
//   );
// }