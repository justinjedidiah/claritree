import { useState } from "react";
import { useFocusStore } from "../stores/useFocusStore";
import { useDataStore } from "../stores/useDataStore";
import NodeInfoCard from "./container-components/NodeInfoCard";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

import type { DashboardProps } from "../pages/Dashboard";

export default function TopContainer({
  filters,
  setFilters,
  onApply,
  filterOptions,
}: {
  filters: DashboardProps;
  setFilters: React.Dispatch<React.SetStateAction<DashboardProps>>;
  onApply: () => void;
  filterOptions: Record<string, any>;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // const focusStack = useFocusStore((s) => s.focusStack);
  const currentFocus = useFocusStore((s) => s.currentFocus);
  const nodesData = useDataStore((s) => s.nodesData);

  const focusedNodes = currentFocus
    .filter((f) => f.type === "node")
    .map((f) => nodesData.find((n) => n.metric === f.id))
    .filter(Boolean);
  
  return (
    <div className={`relative bg-white border-b border-gray-200 transition-all ${
        collapsed ? "pb-0" : "pb-6"
      }`}
    >
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-1">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 leading-none">
            Period
          </span>

          <select
            value={filters.period}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, period: e.target.value }))
            }
            className="h-8 bg-gray-50 border border-gray-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {filterOptions.periods?.map((periodOption: string) => (
              <option key={periodOption} value={periodOption}>
                {periodOption}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onApply}
          className="h-8 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition"
        >
          Apply
        </button>
      </div>
      {/* Content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          collapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
        }`}
      >
        {focusedNodes.length === 0 ? (
          <div className="px-4 py-4 text-center text-gray-400">
            Click a node to inspect details
          </div>
        ) : (
          <div className="px-4 py-4 flex gap-1 overflow-x-auto">
            {focusedNodes.map((node, index) => (
              <NodeInfoCard key={index} node={node!} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Center Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`
          absolute left-1/2 bottom-0 translate-y-1/2 -translate-x-1/2
          w-10 h-10 flex items-center justify-center
          rounded-full bg-white
          border border-gray-200
          cursor-pointer
          transition-all duration-200 ease-in-out
          hover:scale-110
          hover:ring-2 hover:ring-blue-500/30
          active:scale-95
          z-10
        `}
      >
        <ChevronDownIcon
          className={`
            w-5 h-5 text-gray-600
            transition-transform duration-300 ease-in-out
            ${collapsed ? "" : "rotate-180"}
          `}
        />
      </button>
    </div>
  );
}