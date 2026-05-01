import type { FlatRow } from './flattenToolResult';

interface Props {
  rows: FlatRow[];
  topMessage?: string;
}

const formatValue = (key: string, val: string | number | null): string => {
  if (val === null || val === undefined) return '—';
  if ((key === 'mom_change' || key === 'yoy_change') && typeof val === 'number') {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${(val * 100).toFixed(2)}%`;
  }
  if (key === 'nominal' && typeof val === 'number') {
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(val);
};

const COLUMN_LABELS: Record<string, string> = {
  period:          'Period',
  metric:          'Metric',
  nominal:         'Value',
  mom_change:      'MoM',
  yoy_change:      'YoY',
  component:       'Component',
  dependent:       'Dependent',
  operation:       'Op',
  cumulative_sign: 'Net Op',
  depth:           'Depth',
  name:            'Name',
  description:     'Description',
};

export default function ToolResultTable({ rows, topMessage }: Props) {
  if (!rows || rows.length === 0) return null;

  const columns = Object.keys(rows[0]);

  return (
    <div className="mt-2">
      {topMessage && (
        <p className="text-[10px] text-gray-400 mb-1 leading-snug">{topMessage}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  className="text-left text-gray-400 font-medium pb-1 pr-3 border-b border-gray-200 whitespace-nowrap"
                >
                  {COLUMN_LABELS[col] ?? col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                {columns.map(col => (
                  <td key={col} className="py-1 pr-3 text-gray-600 whitespace-nowrap">
                    {formatValue(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}