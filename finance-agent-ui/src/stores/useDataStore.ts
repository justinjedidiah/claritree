import { create } from "zustand";

export type NodeData = {
    period: string;
    metric: string;
    nominal: number;
    mom_change: number;
    yoy_change: number;
}

type DataState = {
    nodesData: NodeData[];
    edgesData: { id: string; source: string; target: string }[];
}

export const useDataStore = create<DataState>(() => ({
    nodesData: [],
    edgesData: [],
}));