import type { NodeData } from "../../stores/useDataStore";

type Props = {
  node: NodeData;
};

const formatPercent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);


export default function NodeInfoCard({ node }: Props) {
  return (
    <div className="w-52 bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm shrink-0">
      {/* Title */}
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-gray-800 truncate">
          {node.metric}
        </h3>
        <p className="text-xs text-gray-500 truncate">
          {node.period}
        </p>
      </div>

      {/* Stats */}
      <div className="space-y-0.5 text-xs">
        <p className="truncate">
          Nominal:{" "}
          <span className="font-medium text-gray-800">
            {node.nominal}
          </span>
        </p>

        <p>
          MoM:{" "}
          <span
            className={
              node.mom_change >= 0
                ? "text-green-600"
                : "text-red-600"
            }
          >
            {formatPercent(node.mom_change)}%
          </span>
        </p>

        <p>
          YoY:{" "}
          <span
            className={
              node.yoy_change >= 0
                ? "text-green-600"
                : "text-red-600"
            }
          >
            {formatPercent(node.yoy_change)}%
          </span>
        </p>
      </div>
    </div>
  );
}

// export default function NodeInfoCard({ node }: Props) {
//   return (
//     <div className="w-56 min-w-0 bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col shrink-0 justify-between overflow-hidden">
//       {/* Title Section */}
//       <div>
//         <h3 className="font-semibold text-gray-800 truncate">
//           {node.metric}
//         </h3>
//         <p className="text-sm text-gray-500 truncate">
//           {node.period}
//         </p>
//       </div>

//       {/* Stats */}
//       <div className="mt-3 space-y-1 text-sm">
//         <p className="truncate">
//           Nominal:{" "}
//           <span className="font-medium">
//             {node.nominal}
//           </span>
//         </p>

//         <p>
//           MoM:{" "}
//           <span
//             className={
//               node.mom_change >= 0
//                 ? "text-green-600"
//                 : "text-red-600"
//             }
//           >
//             {formatPercent(node.mom_change)}%
//           </span>
//         </p>

//         <p>
//           YoY:{" "}
//           <span
//             className={
//               node.yoy_change >= 0
//                 ? "text-green-600"
//                 : "text-red-600"
//             }
//           >
//             {formatPercent(node.yoy_change)}%
//           </span>
//         </p>
//       </div>
//     </div>
//   );
// }