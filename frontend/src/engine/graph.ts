import dagre from "dagre";
import { MarkerType } from "reactflow";
import { api } from "../api/client";
import { useDataStore } from "../stores/useDataStore";

import type { Node, Edge } from "reactflow";
import type { DashboardProps } from "../pages/Dashboard";

// ---------- DAGRE LAYOUT ----------
export const layoutGraph = (nodes: Node[], edges: Edge[]) => {
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



// ---------- DATA TRANSLATE BACKEND TO FRONTEND ----------
export const processNodes = (rawNodesData: any[]): Node[] => {
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

export const processEdges = (rawEdgesData: any[]): Edge[] => {
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

// ---------- DATA FETCH ----------
export const fetchData = async (filters: DashboardProps): Promise<{nodes: Node[], edges: Edge[]}> => {
  const period = filters.period ? filters.period : "latest";
  const report_id = filters.report_id ? filters.report_id : 1;
  const resNodes = await api.get(`/data_with_filters/${report_id}/${period}`);
  const resEdges = await api.get(`/formulas_by_report_id/${report_id}`);
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

export const fetchFilterOptions = async (): Promise<Record<string, any>> => {
  const res = await api.get("/filter_options");
  return res.data;
}