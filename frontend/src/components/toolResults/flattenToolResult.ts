// Flattened row type — generic key-value record
export type FlatRow = Record<string, string | number | null>;

export interface FlattenedResult {
  type: 'table' | 'nested';
  topMessage?: string;
  rows?: FlatRow[];           // for type === 'table'
  sections?: NestedSection[]; // for type === 'nested'
}

export interface NestedSection {
  label: string;
  items: FlatRow[] | string[]; // string[] for pill lists, FlatRow[] for sub-tables
  itemType: 'pills' | 'table';
}

// --- helpers ---

function flattenValues(values: Record<string, unknown> | Record<string, unknown>[]): FlatRow[] {
  if (!values) return [];
  const arr = Array.isArray(values) ? values : [values];
  return arr.map(v => ({
    period:     (v.period     as string | null) ?? null,
    nominal:    (v.nominal    as number | null) ?? null,
    mom_change: (v.mom_change as number | null) ?? null,
    yoy_change: (v.yoy_change as number | null) ?? null,
  }));
}

// --- per-tool flatteners ---

function flattenMetricValues(result: Record<string, unknown>): FlattenedResult {
  const values = (result.values as Record<string, unknown>[]) ?? [];
  const rows: FlatRow[] = values.map(v => ({
    period:     v.period     as string,
    nominal:    v.nominal    as number,
    mom_change: v.mom_change as number,
    yoy_change: v.yoy_change as number,
  }));
  return { type: 'table', rows };
}

function flattenAllReports(result: Record<string, unknown>): FlattenedResult {
  const reports = (result.reports as Record<string, unknown>[]) ?? [];
  const rows: FlatRow[] = reports.map(r => ({
    name:        r.name        as string,
    description: r.description as string,
  }));
  return { type: 'table', rows };
}

function flattenMetricsByReport(result: Record<string, unknown>): FlattenedResult {
  return {
    type: 'nested',
    sections: [
      {
        label:    'Primary Metrics',
        items:    (result.primary_metrics   as string[]) ?? [],
        itemType: 'pills',
      },
      {
        label:    'Component Metrics',
        items:    (result.component_metrics as string[]) ?? [],
        itemType: 'pills',
      },
    ],
  };
}

function flattenReportsByMetric(result: Record<string, unknown>): FlattenedResult {
  const toRows = (arr: Record<string, unknown>[]): FlatRow[] =>
    arr.map(r => ({ name: r.name as string, description: r.description as string }));

  return {
    type: 'nested',
    sections: [
      {
        label:    'Primary In',
        items:    toRows((result.primary_in   as Record<string, unknown>[]) ?? []),
        itemType: 'table',
      },
      {
        label:    'Component In',
        items:    toRows((result.component_in as Record<string, unknown>[]) ?? []),
        itemType: 'table',
      },
    ],
  };
}

function flattenMetricComponents(result: Record<string, unknown>): FlattenedResult {
  const components = (result.components as Record<string, unknown>[]) ?? [];
  const rows: FlatRow[] = components.flatMap(c => {
    const valueRows = flattenValues(
      c.values as Record<string, unknown> | Record<string, unknown>[]
    );
    if (valueRows.length === 0) {
      return [{
        component:  c.component  as string,
        ...(c.operation !== undefined
          ? { operation: c.operation as string }
          : { cumulative_sign: (c.cumulative_sign ?? ' ') as string }),
        depth:      c.depth      as number,
        period:     null,
        nominal:    null,
        mom_change: null,
        yoy_change: null,
      }];
    }
    return valueRows.map(v => ({
      component: c.component as string,
      ...(c.operation !== undefined
        ? { operation: c.operation as string }
        : { cumulative_sign: (c.cumulative_sign ?? ' ') as string }),
      depth:     c.depth     as number,
      ...v,
    }));
  });

  return {
    type:       'table',
    topMessage: `${result.metric}  ·  depth: ${result.depth}  ·  period: ${result.period}`,
    rows,
  };
}

function flattenMetricDependents(result: Record<string, unknown>): FlattenedResult {
  const dependents = (result.dependents as Record<string, unknown>[]) ?? [];
  const rows: FlatRow[] = dependents.flatMap(d => {
    const valueRows = flattenValues(
      d.values as Record<string, unknown> | Record<string, unknown>[]
    );
    if (valueRows.length === 0) {
      return [{
        dependent:       d.dependent       as string,
        ...(d.cumulative_sign !== undefined
          ? { cumulative_sign: d.cumulative_sign as string }
          : { operation: (d.operation ?? ' ') as string }),
        depth:           d.depth           as number,
        period:          null,
        nominal:         null,
        mom_change:      null,
        yoy_change:      null,
      }];
    }
    return valueRows.map(v => ({
      dependent:       d.dependent       as string,
      ...(d.cumulative_sign !== undefined
        ? { cumulative_sign: d.cumulative_sign as string }
        : { operation: (d.operation ?? ' ') as string }),
      depth:           d.depth           as number,
      ...v,
    }));
  });

  return {
    type:       'table',
    topMessage: `${result.metric}  ·  depth: ${result.depth}  ·  period: ${result.period}`,
    rows,
  };
}

// --- main dispatcher ---

const FLATTENERS: Record<string, (r: Record<string, unknown>) => FlattenedResult> = {
  get_metric_values:    flattenMetricValues,
  get_all_reports:      flattenAllReports,
  get_metrics_by_report: flattenMetricsByReport,
  get_reports_by_metric: flattenReportsByMetric,
  get_metric_components: flattenMetricComponents,
  get_metric_dependents: flattenMetricDependents,
};

export function flattenToolResult(
  toolName: string,
  result: unknown
): FlattenedResult | null {
  const flattener = FLATTENERS[toolName];
  if (!flattener) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = typeof result === 'string' ? JSON.parse(result) : (result as Record<string, unknown>);
  } catch {
    return null;
  }

  return flattener(parsed);
}