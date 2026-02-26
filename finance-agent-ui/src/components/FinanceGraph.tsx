import { useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  MarkerType
} from "reactflow";
import type { Node, Edge } from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { api } from "../api/client";

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
  return rawEdgesData.map(rawEdgeData => ({
    id: rawEdgeData.id,
    target: rawEdgeData.target,
    source: rawEdgeData.source,
    style: {
      stroke: rawEdgeData.operation == '+' ? '#16a34a' : '#dc2626',
      strokeWidth: 2
    }
  }))
}

const fetchInitialData = async (): Promise<{nodes: Node[], edges: Edge[]}> => {
  const resNodes = await api.get("/select_by_period/latest");
  const resEdges = await api.get("/all_formulas");
  const rawNodes = processNodes(resNodes.data.nodes);
  const edges = processEdges(resEdges.data.formulas);
  return {
    nodes: layoutGraph(rawNodes, edges),
    edges: edges
  };
}

// ---------- COMPONENT ----------
function FinanceGraphInner() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await fetchInitialData();
      setNodes(data.nodes);
      setEdges(data.edges);
    };
    load();
  },[]);

  return (
    <div style={{ height: '600px', width: '100%' }} className="bg-white rounded-xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultEdgeOptions={{
          animated: false,
          style: { stroke: '#7A7A73', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.Arrow, // Options: Arrow, ArrowClosed
            color: '#7A7A73',             // Match your edge color
            width: 8,
            height: 16,
            strokeWidth: 3
          }
        }}
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