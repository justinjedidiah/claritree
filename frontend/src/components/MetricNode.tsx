import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";

interface MetricNodeData {
  metric: string;
  mom_change?: number;
  yoy_change?: number;
  nominal?: string;

  isFocused?: boolean;
  isConnected?: boolean;
  isDimmed?: boolean;
}

const formatNumber = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

export default function MetricNode({ data }: NodeProps<MetricNodeData>) {
  const isPositive = data.mom_change && data.mom_change > 0;
  const isNegative = data.mom_change && data.mom_change < 0;

  return (
    <div
      className={`
        relative w-42.5 p-1.5 rounded-lg font-sans transition-all duration-200 ease-in-out
        ${data.isDimmed ? "opacity-25 scale-95" : "opacity-100"}
        ${data.isFocused ? "scale-105 shadow-xl ring-2 ring-blue-500 bg-white" : ""}
        ${data.isConnected && !data.isFocused ? "shadow-md bg-white ring-blue-300 ring-1" : ""}
        ${!data.isFocused && !data.isConnected ? "bg-indigo-100 border border-blue-50 shadow-sm" : ""}
      `}
      // className="bg-blue-500/10 backdrop-blur-md text-gray-800 p-1.5 rounded-lg border border-blue-500/20 shadow-sm w-42.5 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg font-sans"
    >
      <Handle
        type="target"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />

      {/* Title and change */}
      <div className="text-sm font-medium text-gray-700 mb-1 flex items-center justify-between w-full overflow-hidden gap-1.5">
        <span className="truncate whitespace-nowrap shrink">
          {data.metric}
        </span>
        {data.mom_change !== undefined && (
          <span
            className={
              `text-xs font-semibold mr-1 ${
                isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
              } shrink-0`
            }
          >
            {isPositive ? '↑' : isNegative ? '↓' : ''}{Math.abs(data.mom_change).toFixed(2)}%
          </span>
        )}
      </div>

      {/* Value with grey background */}
      {data.nominal && (
        <div className="text-base font-semibold text-gray-900 tracking-tight p-1.5 rounded-lg bg-gray-100 text-right">
          {formatNumber(Number(data.nominal))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />
    </div>
  );
}