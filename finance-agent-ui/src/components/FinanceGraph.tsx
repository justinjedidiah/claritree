import React, { useMemo } from "react";
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

import MetricNode from "./MetricNode";

const nodeTypes = {
  metric: MetricNode
};

// ---------- DAGRE LAYOUT ----------
const layoutGraph = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({
    rankdir: "LR",
    nodesep: 80,
    ranksep: 140
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
const initialNodes: Node[] = [
  {
    id: "profit",
    type: "metric",
    data: { 
      label: "Net Profit", 
      change: -12,
      value: "$45K",
      category: "profit"
    },
    position: { x: 0, y: 0 }
  },
  {
    id: "revenue",
    type: "metric",
    data: { 
      label: "Revenue", 
      change: 5,
      value: "$280K",
      category: "revenue"
    },
    position: { x: 0, y: 0 }
  },
  {
    id: "cost",
    type: "metric",
    data: { 
      label: "Total Cost", 
      change: 18,
      value: "$235K",
      category: "cost"
    },
    position: { x: 0, y: 0 }
  },
  {
    id: "marketing",
    type: "metric",
    data: { 
      label: "Marketing", 
      change: 22,
      value: "$85K",
      category: "cost"
    },
    position: { x: 0, y: 0 }
  }
];

const initialEdges: Edge[] = [
  { 
    id: "e1", 
    source: "revenue", 
    target: "profit",
  },
  { 
    id: "e2", 
    source: "cost", 
    target: "profit",
  },
  { 
    id: "e3", 
    source: "marketing", 
    target: "cost",
  }
];

// ---------- COMPONENT ----------
function FinanceGraphInner() {
  const layoutedNodes = useMemo(
    () => layoutGraph(initialNodes, initialEdges),
    []
  );

  return (
    <div style={{ height: '600px', width: '100%' }} className="bg-gray-950 rounded-xl">
      <ReactFlow
        nodes={layoutedNodes}
        edges={initialEdges}
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