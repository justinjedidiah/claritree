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

# --- data tools ---
@tool
def get_all_metrics() -> dict:
    """
    Get a list of all available metric names in the system.
    Use this first if you're unsure what metrics exist before calling other tools.
    """
    q = "SELECT DISTINCT metric FROM financials"

    with engine.connect() as conn:
        r = conn.execute(text(q))
        rows = [x[0] for x in r]

    return {"metrics": rows}

@tool
def get_all_formulas() -> dict:
    """
    Get all calculation formulas that define how metrics are derived from each other.
    Returns the full calculation tree as parent-child relationships with operations (+, -, *, /).
    Use this to understand how a metric is built up.
    """
    q = "SELECT id, parent_metric as target, child_metric as source, operation FROM calculation_formulas"

    with engine.connect() as conn:
        r = conn.execute(text(q))
        rows = [dict(x._mapping) for x in r]

    return {"formulas": rows}

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
    SELECT period, nominal, mom_change, yoy_change
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
        SELECT parent_metric as dependent
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
        print(f"placeholders: {placeholders}")
        print(f"params: {params}")
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

    return {"metric": metric, "depth": depth, "period": period, "dependents": tree_rows}

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

# @tool
# def generate_analysis_card(title: str, content: str, card_type: str = "info") -> dict:
#     """
#     Generate an analysis card shown in the top panel of the UI.
#     card_type: 'info' | 'warning' | 'insight'
#     Use this for key insights worth saving — not every observation, only important findings.
#     """
#     return {"__ui_event__": True, "type": "generate_analysis_card", "title": title, "content": content, "card_type": card_type}


# exports
data_tools = [
    get_all_metrics,
    get_all_formulas,
    get_metric_values,
    get_metric_components,
    get_metric_dependents,
]
ui_tools = [
    highlight_nodes,
    # generate_analysis_card,
]
all_tools = data_tools + ui_tools