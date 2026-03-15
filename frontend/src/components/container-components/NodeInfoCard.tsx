import type { NodeData } from "../../stores/useDataStore";

type Props = { node: NodeData };

const formatNumber = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

const formatPercent = (v: number) =>
  (v >= 0 ? "+" : "") +
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + "%";

const ChangeChip = ({ value }: { value: number }) => (
  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
    value >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
  }`}>
    {formatPercent(value)}
  </span>
);

export default function NodeInfoCard({ node }: Props) {
  return (
    <div className="w-52 shrink-0 bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-150">
      {/* header */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-800 truncate capitalize">
            {node.metric.replace(/_/g, " ")}
          </h3>
          <p className="text-xs text-gray-400">{node.period}</p>
        </div>
        <span className="text-xs text-gray-300 font-mono ml-2 shrink-0">IDR</span>
      </div>

      {/* nominal */}
      <p className="text-lg font-semibold text-gray-900 mb-2 tabular-nums">
        {formatNumber(node.nominal)}
      </p>

      {/* changes */}
      <div className="flex gap-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">MoM</span>
          <ChangeChip value={node.mom_change} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">YoY</span>
          <ChangeChip value={node.yoy_change} />
        </div>
      </div>
    </div>
  );
}
