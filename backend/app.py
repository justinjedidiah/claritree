from fastapi import FastAPI, Query
from pydantic import BaseModel
from sqlalchemy import create_engine, text

app = FastAPI()

engine = create_engine(
    "sqlite:///backend/db/finance.db",
    connect_args={"check_same_thread": False}
)

# ---------
# Models
# ---------

class SQLQuery(BaseModel):
    query: str


# ---------
# Routes
# ---------

@app.get("/")
def root():
    return {"status": "ok"}


@app.post("/run_sql")
def run_sql(body: SQLQuery):

    if "select" not in body.query.lower():
        return {"error": "Only SELECT allowed"}

    with engine.connect() as conn:
        result = conn.execute(text(body.query))
        rows = [dict(r._mapping) for r in result]

    return {"rows": rows}

@app.get("/metrics")
def metrics():
    q = "SELECT DISTINCT metric FROM financials"

    with engine.connect() as conn:
        r = conn.execute(text(q))
        rows = [x[0] for x in r]

    return {"metrics": rows}


@app.get("/metric_children/{metric}")
def metric_children(metric: str):
    q = """
    SELECT child_metric, operation
    FROM calculation_formulas
    WHERE parent_metric = :m
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"m": metric})
        rows = [dict(x._mapping) for x in r]

    return {"children": rows}


@app.get("/metric_parents/{metric}")
def metric_parents(metric: str):
    q = """
    SELECT parent_metric
    FROM calculation_formulas
    WHERE child_metric = :m
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"m": metric})
        rows = [dict(x._mapping) for x in r]

    return {"parents": rows}


@app.get("/metric_values/{metric}")
def metric_values(
    metric: str,
    start: str | None = Query(None),
    end: str | None = Query(None),
):

    q = """
    SELECT month, nominal
    FROM financials
    WHERE metric = :m
    """

    params = {"m": metric}

    if start:
        q += " AND month >= :s"
        params["s"] = start

    if end:
        q += " AND month <= :e"
        params["e"] = end

    q += " ORDER BY month"

    with engine.connect() as conn:
        r = conn.execute(text(q), params)
        rows = [dict(x._mapping) for x in r]

    return {"values": rows}

@app.get("/metric_descendants/{metric}")
def metric_descendants(metric: str):

    q = """
    WITH RECURSIVE metric_tree AS (
        -- level 1 (direct children)
        SELECT
            parent_metric,
            child_metric,
            operation,
            1 as depth
        FROM calculation_formulas
        WHERE parent_metric = :metric

        UNION ALL

        -- deeper levels
        SELECT
            cf.parent_metric,
            cf.child_metric,
            cf.operation,
            mt.depth + 1
        FROM calculation_formulas cf
        JOIN metric_tree mt
            ON cf.parent_metric = mt.child_metric
    )
    SELECT *
    FROM metric_tree;
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"metric": metric})
        rows = [dict(x._mapping) for x in r]

    return {"descendants": rows}

@app.get("/metric_impact/{metric}")
def metric_impact(metric: str):

    q = """
    WITH RECURSIVE metric_tree AS (

        -- base level
        SELECT
            parent_metric,
            child_metric,
            operation,
            CASE
                WHEN operation = '+' THEN 1
                WHEN operation = '-' THEN -1
                ELSE 1
            END AS cumulative_sign,
            1 as depth
        FROM calculation_formulas
        WHERE parent_metric = :metric

        UNION ALL

        -- recursive step
        SELECT
            cf.parent_metric,
            cf.child_metric,
            cf.operation,

            mt.cumulative_sign *
            CASE
                WHEN cf.operation = '+' THEN 1
                WHEN cf.operation = '-' THEN -1
                ELSE 1
            END,

            mt.depth + 1
        FROM calculation_formulas cf
        JOIN metric_tree mt
            ON cf.parent_metric = mt.child_metric
    )

    SELECT
        child_metric,
        cumulative_sign,
        depth
    FROM metric_tree;
    """

    with engine.connect() as conn:
        r = conn.execute(text(q), {"metric": metric})
        rows = [dict(x._mapping) for x in r]

    return {"impact_chain": rows}