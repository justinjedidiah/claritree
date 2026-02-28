import { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  MarkerType
} from "reactflow";
import type { Node, Edge } from "reactflow";
import {
  useNodesState,
  useEdgesState,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { api } from "../api/client";
import { useFocusStore } from "../stores/useFocusStore";
import { useDataStore } from "../stores/useDataStore";

import MetricNode from "./MetricNode";

const nodeTypes = {
  metric: MetricNode
};

// ---------- DAGRE LAYOUT ----------
const layoutGraph = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({
    rankdir: "RL",
    nodesep: 25,
    ranksep: 75
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: 180,
      height: 60
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - 90,
        y: pos.y - 30
      }
    };
  });
};

// ---------- DATA (outside component to prevent re-creation) ----------
const processNodes = (rawNodesData: any[]): Node[] => {
  return rawNodesData.map(rawNodeData => ({
      id : rawNodeData.metric,
      type: "metric",
      data: {
        period: rawNodeData.period,
        metric: rawNodeData.metric,
        nominal: rawNodeData.nominal,
        mom_change: rawNodeData.mom_change,
        yoy_change: rawNodeData.yoy_change
      },
      position: { x:0, y:0 }
  }));
}

const processEdges = (rawEdgesData: any[]): Edge[] => {
  return rawEdgesData.map(rawEdgeData => {
    const edgeColor = rawEdgeData.operation === '+' ? '#16a34aBF' : '#dc2626BF';
    const arrowHeadColor = rawEdgeData.operation === '+' ? '#16a34a80' : '#dc262680';
    return {
      id: rawEdgeData.id,
      target: rawEdgeData.target,
      source: rawEdgeData.source,
      style: {
        stroke: edgeColor,
        strokeWidth: 2
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: arrowHeadColor, 
        width: 20,
        height: 20,
      },
    }
  })
}

const fetchInitialData = async (): Promise<{nodes: Node[], edges: Edge[]}> => {
  const resNodes = await api.get("/select_by_period/latest");
  const resEdges = await api.get("/all_formulas");
  const rawNodes = processNodes(resNodes.data.nodes);
  const edges = processEdges(resEdges.data.formulas);

  // Save to store
  useDataStore.setState({ nodesData: rawNodes.map(n => n.data) });
  useDataStore.setState({ edgesData: edges.map(e => ({ id:e.id, source: e.source, target: e.target })) });
  return {
    nodes: layoutGraph(rawNodes, edges),
    edges: edges
  };
}

// ---------- COMPONENT ----------
function FinanceGraphInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const pushFocus = useFocusStore((s) => s.pushFocus);
  const clearFocus = useFocusStore((s) => s.clearCurrentFocus);
  const currentFocus = useFocusStore((s) => s.currentFocus);

  // Data fetch
  useEffect(() => {
    const load = async () => {
      const data = await fetchInitialData();
      setNodes(data.nodes);
      setEdges(data.edges);
    };
    load();
  },[]);

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
  );
}

export default function FinanceGraph() {
  return (
    <ReactFlowProvider>
      <FinanceGraphInner />
    </ReactFlowProvider>
  );
}