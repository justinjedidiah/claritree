from langchain_core.tools import tool
from sqlalchemy import text
from typing import Optional
from db.db import engine

# --- data tools ---

@tool
def get_data_by_period(period: str) -> dict:
    """
    Get all financial metrics for a given period.
    Use 'latest' to get the most recent period, or pass a specific period string e.g. '2024-01'.
    Returns all metrics with their nominal value, MoM change, and YoY change.
    """
    if period == "latest":
        q = "SELECT period, metric, nominal, mom_change, yoy_change FROM financials WHERE period = (SELECT MAX(period) FROM financials)"
    else:
        q = "SELECT period, metric, nominal, mom_change, yoy_change FROM financials WHERE period = :period"

    with engine.connect() as conn:
        r = conn.execute(text(q), {"period": period})
        rows = [dict(x._mapping) for x in r]

    return {"nodes": rows}

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
def get_metric_children(metric: str) -> dict:
    """
    Get the direct children (components) of a metric in the calculation tree.
    For example, 'gross_profit' might have children 'revenue' and 'cogs'.
    Use this to understand what a metric is made of one level down.
    """
    q = """
    SELECT child_metric, operation
    FROM calculation_formulas
    WHERE parent_metric = :m
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"m": metric})
        rows = [dict(x._mapping) for x in r]

    return {"children": rows}

@tool
def get_metric_parents(metric: str) -> dict:
    """
    Get the direct parents of a metric — which metrics depend on this one.
    Use this to understand the upstream impact of a metric.
    """
    q = """
    SELECT parent_metric
    FROM calculation_formulas
    WHERE child_metric = :m
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"m": metric})
        rows = [dict(x._mapping) for x in r]

    return {"parents": rows}

@tool
def get_metric_values(metric: str, start: Optional[str] = None, end: Optional[str] = None) -> dict:
    """
    Get historical values for a specific metric over time.
    Optionally filter by start and end period (e.g. start='2024-01', end='2024-06').
    Returns nominal value, MoM change, and YoY change per period.
    Use this when the user asks about trends, growth, or performance over time.
    """
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
def get_metric_descendants(metric: str) -> dict:
    """
    Recursively get all descendants of a metric in the calculation tree — all levels deep.
    Returns each descendant with its depth level.
    Use this for a full breakdown of what ultimately makes up a metric.
    """
    q = """
    WITH RECURSIVE metric_tree AS (
        SELECT parent_metric, child_metric, operation, 1 as depth
        FROM calculation_formulas
        WHERE parent_metric = :metric

        UNION ALL

        SELECT cf.parent_metric, cf.child_metric, cf.operation, mt.depth + 1
        FROM calculation_formulas cf
        JOIN metric_tree mt ON cf.parent_metric = mt.child_metric
    )
    SELECT * FROM metric_tree
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"metric": metric})
        rows = [dict(x._mapping) for x in r]

    return {"descendants": rows}

@tool
def get_metric_impact(metric: str) -> dict:
    """
    Get the full downstream impact chain of a metric — which parent metrics it affects
    and whether the effect is positive or negative (cumulative sign).
    Use this when the user asks 'if X changes, what else is affected?'
    """
    q = """
    WITH RECURSIVE metric_tree AS (
        SELECT
            parent_metric, child_metric, operation,
            CASE
                WHEN operation = '+' THEN 1
                WHEN operation = '-' THEN -1
                ELSE 1
            END AS cumulative_sign,
            1 as depth
        FROM calculation_formulas
        WHERE parent_metric = :metric

        UNION ALL

        SELECT
            cf.parent_metric, cf.child_metric, cf.operation,
            mt.cumulative_sign * CASE
                WHEN cf.operation = '+' THEN 1
                WHEN cf.operation = '-' THEN -1
                ELSE 1
            END,
            mt.depth + 1
        FROM calculation_formulas cf
        JOIN metric_tree mt ON cf.parent_metric = mt.child_metric
    )
    SELECT child_metric, cumulative_sign, depth FROM metric_tree
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"metric": metric})
        rows = [dict(x._mapping) for x in r]

    return {"impact_chain": rows}


# --- ui tools ---

@tool
def highlight_nodes(metrics: list[str]) -> dict:
    """
    Highlight nodes in the React Flow graph on the frontend.
    color: 'yellow' | 'red' | 'green' | 'blue'
    Use this whenever you refer to a specific node so the user can see it visually.
    """
    return {"__ui_event__": True, "type": "highlight_nodes", "metrics": metrics}

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
    get_data_by_period,
    get_all_formulas,
    get_all_metrics,
    get_metric_children,
    get_metric_parents,
    get_metric_values,
    get_metric_descendants,
    get_metric_impact,
]
ui_tools = [
    highlight_nodes,
    # generate_analysis_card,
]
all_tools = data_tools + ui_tools