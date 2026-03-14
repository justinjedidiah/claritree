import { useState } from "react";
import { useFocusStore } from "../stores/useFocusStore";
import { useDataStore } from "../stores/useDataStore";
import NodeInfoCard from "./container-components/NodeInfoCard";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import type { DashboardProps } from "../pages/Dashboard";

const EXPANDED_HEIGHT = "13rem"; // fixed — graph never shifts

export default function TopContainer({
  filters,
  setFilters,
  onApply,
  filterOptions,
  applyStatus,
}: {
  filters: DashboardProps;
  setFilters: React.Dispatch<React.SetStateAction<DashboardProps>>;
  onApply: () => void;
  filterOptions: Record<string, any>;
  applyStatus: 'idle' | 'applied';
}) {
  const [collapsed, setCollapsed] = useState(false);
  const currentFocus = useFocusStore((s) => s.currentFocus);
  const nodesData = useDataStore((s) => s.nodesData);

  const focusedNodes = currentFocus
    .filter((f) => f.type === "node")
    .map((f) => nodesData.find((n) => n.metric === f.id))
    .filter(Boolean);

  return (
    <div className="relative shrink-0">
      <div
        style={{ height: collapsed ? "0" : EXPANDED_HEIGHT }}
        className="bg-white border-b border-gray-200 transition-all duration-300 overflow-hidden"
      >
        <div className="h-full flex flex-col px-4 pt-3 pb-2 gap-2">

          {/* filter bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Period</span>
            <select
              value={filters.period}
              onChange={(e) => setFilters((prev) => ({ ...prev, period: e.target.value }))}
              className="h-7 bg-gray-50 border border-gray-200 rounded-md px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {filterOptions.periods?.map((p: string) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={onApply}
              className={`h-7 px-4 text-xs font-semibold rounded-md transition-all duration-200 ${
                applyStatus === 'applied'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {applyStatus === 'applied' ? '✓ Applied' : 'Apply'}
            </button>
          </div>

          {/* cards row — fixed height, always occupies same space */}
          <div className="bg-white border-gray-100 border-2 flex-1 flex items-stretch overflow-hidden">
            {focusedNodes.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-300 text-xs pl-1 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200 inline-block" />
                Click a node to inspect details
              </div>
            ) : (
              <div className="flex gap-2 pt-1 pb-1 overflow-x-auto scrollbar-thin">
                {focusedNodes.map((node, i) => (
                  <NodeInfoCard key={i} node={node!} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`${collapsed ? "top-0" : "bottom-0"} absolute left-1/2 translate-y-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md hover:scale-110 active:scale-95 transition-all z-10`}
      >
        <ChevronDownIcon
          className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`}
        />
      </button>
    </div>
  );
}
