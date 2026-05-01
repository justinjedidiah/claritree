from langchain_core.tools import tool
from sqlalchemy import text
from typing import Optional
from db.db import engine
from difflib import get_close_matches

# --- helpers ---
def resolve_metric_name(name: str) -> str:
    """Find the closest matching metric name from the DB."""
    with engine.connect() as conn:
        r = conn.execute(text("SELECT DISTINCT metric FROM financials"))
        all_metrics = [x[0] for x in r]
    
    # exact match first
    if name in all_metrics:
        return name
    
    # try normalizing spaces/underscores
    normalized = name.lower().replace(" ", "_")
    if normalized in all_metrics:
        return normalized

    # fuzzy match
    matches = get_close_matches(normalized, all_metrics, n=1, cutoff=0.6)
    return matches[0] if matches else name  # fall back to original if no match

def resolve_report_name(name: str) -> str | None:
    with engine.connect() as conn:
        r = conn.execute(text("SELECT name FROM reports"))
        all_names = [x[0] for x in r]
    # exact
    if name in all_names: return name
    # normalized
    norm = name.lower().replace("_", " ").strip()
    for n in all_names:
        if n.lower().replace("_", " ").strip() == norm:
            return n
    # fuzzy
    matches = get_close_matches(name, all_names, n=1, cutoff=0.6)
    return matches[0] if matches else None

# --- data tools ---
@tool
def get_all_reports() -> dict:
    """Get all available reports with their id, name and description."""
    with engine.connect() as conn:
        r = conn.execute(text("SELECT id, name, description FROM reports ORDER BY id"))
        rows = [dict(x._mapping) for x in r]
    return {"reports": rows}

@tool
def get_metrics_by_report(report_name: str) -> dict:
    """Get all metrics that belong to a report, including all their descendants recursively."""
    resolved = resolve_report_name(report_name)
    if not resolved:
        return {"error": f"Report '{report_name}' not found"}

    # fetch direct report metrics
    q_direct = """
    SELECT mr.metric FROM metric_reports mr
    INNER JOIN reports r ON r.id = mr.report_id
    WHERE r.name = :name
    """

    # fetch all descendants recursively
    q_descendants = """
    WITH RECURSIVE report_metrics AS (
        SELECT mr.metric FROM metric_reports mr
        INNER JOIN reports r ON r.id = mr.report_id
        WHERE r.name = :name
        UNION
        SELECT cf.child_metric FROM calculation_formulas cf
        INNER JOIN report_metrics rm ON cf.parent_metric = rm.metric
    )
    SELECT metric FROM report_metrics ORDER BY metric
    """

    with engine.connect() as conn:
        direct = {x[0] for x in conn.execute(text(q_direct), {"name": resolved})}
        all_metrics = [x[0] for x in conn.execute(text(q_descendants), {"name": resolved})]

    return {
        "report": resolved,
        "primary_metrics": sorted(direct),
        "component_metrics": sorted(set(all_metrics) - direct),
    }

@tool
def get_reports_by_metric(metric: str) -> dict:
    """
    Get all reports that a given metric belongs to, either as a primary metric or as a component.
    Use this when the user asks: 'what reports contains X', 'what reports have x'.
    """
    resolved = resolve_metric_name(metric)

    # reports where metric is directly tagged
    q_direct = """
    SELECT r.id, r.name, r.description FROM reports r
    INNER JOIN metric_reports mr ON mr.report_id = r.id
    WHERE mr.metric = :metric
    """

    # reports where metric appears as a descendant of a primary metric
    q_component = """
    WITH RECURSIVE ancestors AS (
        SELECT cf.parent_metric FROM calculation_formulas cf
        WHERE cf.child_metric = :metric
        UNION
        SELECT cf.parent_metric FROM calculation_formulas cf
        INNER JOIN ancestors a ON cf.child_metric = a.parent_metric
    )
    SELECT DISTINCT r.id, r.name, r.description FROM reports r
    INNER JOIN metric_reports mr ON mr.report_id = r.id
    INNER JOIN ancestors a ON a.parent_metric = mr.metric
    """

    with engine.connect() as conn:
        direct_rows = [dict(x._mapping) for x in conn.execute(text(q_direct), {"metric": resolved})]
        direct_ids = {r["id"] for r in direct_rows}
        component_rows = [dict(x._mapping) for x in conn.execute(text(q_component), {"metric": resolved})]

    return {
        "metric": resolved,
        "primary_in": direct_rows,
        "component_in": [r for r in component_rows if r["id"] not in direct_ids],
    }

@tool
def get_metric_values(metric: str, start: Optional[str] = None, end: Optional[str] = None) -> dict:
    """
    Get historical values for a specific metric over time.
    Optionally filter by start and end period (e.g. start='2024-01', end='2024-06').
    Returns nominal value, MoM change, and YoY change per period.
    Use this when the user asks about trends, growth, or performance over time.
    """
    metric = resolve_metric_name(metric)
    q = """
    SELECT period, metric, nominal, mom_change, yoy_change
    FROM financials
    WHERE metric = :m
    """
    params: dict = {"m": metric}

    if start:
        q += " AND period >= :s"
        params["s"] = start
    if end:
        q += " AND period <= :e"
        params["e"] = end

    q += " ORDER BY period"

    with engine.connect() as conn:
        r = conn.execute(text(q), params)
        rows = [dict(x._mapping) for x in r]

    return {"values": rows}

@tool
def get_metric_components(metric: str, depth: str = "direct", period: str = "latest") -> dict:
    """
    Get metrics that builds the metric — what makes up its value.
    Use this when the user asks: 'what makes up X', 'what drives X', 'what contributes to X',
    'what are the inputs to X', 'what affects X', 'what is X made of', what is downstream of X,
    'what contributes the most to X', 'which component is largest in X'.

    - depth='direct': immediate inputs only (one level down)
    - depth='all': all inputs recursively (all levels deep)
    - period: which period to fetch values for (default 'latest'), you can use patterns in SQL e.g. "2024-__" or directly "2024-03".

    if asked in a specific year use period = "yyyy-__" e.g. "2023-__" this will match 2023 jan to dec

    The response includes the period and each component's nominal value, MoM change, and YoY change — always reference the period and these numbers in your answer.
    IMPORTANT: After calling this tool, call highlight_nodes with mode='with_descendants'.
    """
    metric = resolve_metric_name(metric)

    if depth == "direct":
        q = """
        SELECT child_metric as component, operation
        FROM calculation_formulas
        WHERE parent_metric = :metric
        """
        with engine.connect() as conn:
            r = conn.execute(text(q), {"metric": metric})
            tree_rows = [dict(x._mapping) for x in r]
        components = [r["component"] for r in tree_rows]
    else:
        q = """
        WITH RECURSIVE metric_tree AS (
            SELECT
                child_metric AS component,
                parent_metric,
                operation,
                CASE
                    WHEN operation = '+' THEN 1
                    WHEN operation = '-' THEN -1
                    ELSE 1
                END AS cumulative_sign,
                1 AS depth
            FROM calculation_formulas
            WHERE parent_metric = :metric

            UNION ALL

            SELECT
                cf.child_metric AS component,
                cf.parent_metric,
                cf.operation,
                mt.cumulative_sign * CASE
                    WHEN cf.operation = '+' THEN 1
                    WHEN cf.operation = '-' THEN -1
                    ELSE 1
                END,
                mt.depth + 1
            FROM calculation_formulas cf
            JOIN metric_tree mt ON cf.parent_metric = mt.component
        )
        SELECT component, case when cumulative_sign = 1 then '+' else '-' end as cumulative_sign, depth FROM metric_tree
        """
        with engine.connect() as conn:
            r = conn.execute(text(q), {"metric": metric})
            tree_rows = [dict(x._mapping) for x in r]
        components = [row["component"] for row in tree_rows]

    # fetch values for all components in one query
    placeholders = ",".join(f":m{i}" for i in range(len(components)))
    params = {f"m{i}": m for i, m in enumerate(components)}
    if period == "latest":
        val_q = f"""
        SELECT metric, period, nominal, mom_change, yoy_change
        FROM financials
        WHERE metric IN ({placeholders})
        AND period = (SELECT MAX(period) FROM financials)
        """
        with engine.connect() as conn:
            r = conn.execute(text(val_q), params)
            values_dict = dict()
            for row in r:
                value_row = dict(row._mapping)
                values_dict[value_row["metric"]] = value_row
    else:
        val_q = f"""
        SELECT metric, period, nominal, mom_change, yoy_change
        FROM financials
        WHERE metric IN ({placeholders})
        AND period LIKE :period
        """
        params["period"] = period
        with engine.connect() as conn:
            r = conn.execute(text(val_q), params)
            values_dict = dict()
            for row in r:
                value_row = dict(row._mapping)
                values_dict.setdefault(value_row["metric"], []).append(value_row)

    # merge values into rows
    for row in tree_rows:
        component = row["component"]
        row["values"] = values_dict.get(component, {})

    return {"metric": metric, "depth": depth, "period": period, "components": tree_rows}

@tool
def get_metric_dependents(metric: str, depth: str = "direct", period: str = "latest") -> dict:
    """
    Get metrics that are calculated from specified metric.
    Use this when the user asks: 'what does X affect', 'what does X impact',
    'what relies on X', 'if X changes what else changes', 'what is upstream of X'.

    - depth='direct': immediate outputs only (one level up)
    - depth='all': all outputs recursively, with cumulative impact sign (+1 or -1)
    - period: which period to fetch values for (default 'latest'), you can use patterns in SQL e.g. "2024-__" or directly "2024-03".

    if asked in a specific year use period = "yyyy-__" e.g. "2023-__" this will match 2023 jan to dec

    The response includes the period and each component's nominal value, MoM change, and YoY change — always reference the period and these numbers in your answer.
    IMPORTANT: After calling this tool, call highlight_nodes with mode='with_ancestors'.
    """
    metric = resolve_metric_name(metric)

    if depth == "direct":
        q = """
        SELECT parent_metric as dependent, operation
        FROM calculation_formulas
        WHERE child_metric = :metric
        """
        with engine.connect() as conn:
            r = conn.execute(text(q), {"metric": metric})
            tree_rows = [dict(x._mapping) for x in r]
        dependents = [row["dependent"] for row in tree_rows]
    else:
        q = """
        WITH RECURSIVE metric_tree AS (
            SELECT
                parent_metric as dependent,
                child_metric,
                operation,
                CASE
                    WHEN operation = '+' THEN 1
                    WHEN operation = '-' THEN -1
                    ELSE 1
                END AS cumulative_sign,
                1 as depth
            FROM calculation_formulas
            WHERE child_metric = :metric

            UNION ALL

            SELECT
                cf.parent_metric as dependent,
                cf.child_metric,
                cf.operation,
                mt.cumulative_sign * CASE
                    WHEN cf.operation = '+' THEN 1
                    WHEN cf.operation = '-' THEN -1
                    ELSE 1
                END,
                mt.depth + 1
            FROM calculation_formulas cf
            JOIN metric_tree mt ON cf.child_metric = mt.dependent
        )
        SELECT dependent, case when cumulative_sign = 1 then '+' else '-' end as cumulative_sign, depth FROM metric_tree
        """
        with engine.connect() as conn:
            r = conn.execute(text(q), {"metric": metric})
            tree_rows = [dict(x._mapping) for x in r]
        dependents = [r["dependent"] for r in tree_rows]

    # fetch values for all dependents in one query
    placeholders = ",".join(f":m{i}" for i in range(len(dependents)))
    params = {f"m{i}": m for i, m in enumerate(dependents)}
    if period == "latest":
        val_q = f"""
        SELECT metric, period, nominal, mom_change, yoy_change
        FROM financials
        WHERE metric IN ({placeholders})
        AND period = (SELECT MAX(period) FROM financials)
        """
        with engine.connect() as conn:
            r = conn.execute(text(val_q), params)
            values_dict = dict()
            for row in r:
                value_row = dict(row._mapping)
                values_dict[value_row["metric"]] = value_row
    else:
        val_q = f"""
        SELECT metric, period, nominal, mom_change, yoy_change
        FROM financials
        WHERE metric IN ({placeholders})
        AND period LIKE :period
        """
        params["period"] = period
        with engine.connect() as conn:
            r = conn.execute(text(val_q), params)
            values_dict = dict()
            for row in r:
                value_row = dict(row._mapping)
                values_dict.setdefault(value_row["metric"], []).append(value_row)

    # merge values into rows
    for row in tree_rows:
        dependent = row["dependent"]
        row["values"] = values_dict.get(dependent, {})

    # fetch source metric value
    if period == "latest":
        src_q = "SELECT metric, period, nominal, mom_change, yoy_change FROM financials WHERE metric = :metric AND period = (SELECT MAX(period) FROM financials)"
        src_params = {"metric": metric}
    else:
        src_q = "SELECT metric, period, nominal, mom_change, yoy_change FROM financials WHERE metric = :metric AND period LIKE :period"
        src_params = {"metric": metric, "period": period}

    with engine.connect() as conn:
        r = conn.execute(text(src_q), src_params)
        source_values = [dict(row._mapping) for row in r]

    return {"metric": metric, "metric_values": source_values, "depth": depth, "period": period, "dependents": tree_rows}

# --- ui tools ---

@tool
def highlight_nodes(metrics: list[str], mode: str = 'default', clear_previous_selections: bool = False) -> dict:
    """
    Highlight nodes in the React Flow graph on the frontend.
    mode: 'default' | 'with_descendants' | 'with_ancestors' | 'with_ancestors_and_descendants'
    clear_previous_selections: True | False
    Use this whenever you refer to a specific node so the user can see it visually.
    """

    metrics = [resolve_metric_name(metric) for metric in metrics]
    return {"__ui_event__": True, "type": "highlight_nodes", "metrics": metrics, "mode": mode, "clear_previous_selections": clear_previous_selections}


# exports
data_tools = [
    get_metrics_by_report,
    get_reports_by_metric,
    get_metric_values,
    get_metric_components,
    get_metric_dependents,
    get_all_reports,
]
ui_tools = [
    highlight_nodes,
]
all_tools = data_tools + ui_tools