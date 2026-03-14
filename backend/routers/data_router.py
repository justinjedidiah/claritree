from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import text
from db.db import engine

data_router = APIRouter()

class SQLQuery(BaseModel):
    query: str


# ---------- UTILITY ENDPOINTS ----------
@data_router.get("/filter_options")
def filter_options():
    q_period = "SELECT DISTINCT period FROM financials ORDER BY period DESC"
    q_reports = "SELECT id, name, description FROM reports ORDER BY id"

    with engine.connect() as conn:
        r = conn.execute(text(q_period))
        periods = [x[0] for x in r]
        r = conn.execute(text(q_reports))
        reports = [dict(x._mapping) for x in r]

    return {"periods": periods, "reports": reports}


# ---------- DATA ENDPOINTS ----------

@data_router.get("/data_with_filters/{report_id}/{period}")
def data_with_filters(report_id:int, period: str):
    if period == 'latest':
        period_clause = "(SELECT MAX(period) FROM financials)"
    else:
        period_clause = ":period"

    q = f"""
    WITH RECURSIVE report_metrics AS (
        -- start: metrics directly linked to the report
        SELECT mr.metric
        FROM metric_reports mr
        WHERE mr.report_id = :report_id

        UNION

        -- recurse: all descendants (components) of those metrics
        SELECT cf.child_metric
        FROM calculation_formulas cf
        INNER JOIN report_metrics rm ON cf.parent_metric = rm.metric
    )
    SELECT f.period, f.metric, f.nominal, f.mom_change, f.yoy_change
    FROM financials f
    INNER JOIN report_metrics rm ON f.metric = rm.metric
    WHERE f.period = {period_clause}
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"report_id": report_id, "period": period})
        rows = [dict(x._mapping) for x in r]

    return {"nodes": rows}

@data_router.get("/formulas_by_report_id/{report_id}")
def formulas_by_report_id(report_id: int):
    q = """
    WITH RECURSIVE report_metrics AS (
        -- start: metrics directly linked to the report
        SELECT mr.metric
        FROM metric_reports mr
        WHERE mr.report_id = :report_id

        UNION

        -- recurse: all descendants (components) of those metrics
        SELECT cf.child_metric as metric
        FROM calculation_formulas cf
        INNER JOIN report_metrics rm ON cf.parent_metric = rm.metric
    )
    SELECT cf.id, cf.parent_metric as target, cf.child_metric as source, cf.operation
    FROM calculation_formulas cf
    WHERE cf.parent_metric in (SELECT metric FROM report_metrics)
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"report_id": report_id})
        rows = [dict(x._mapping) for x in r]

    return {"formulas": rows}
