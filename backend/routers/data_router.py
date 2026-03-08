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
    q = "SELECT DISTINCT period FROM financials ORDER BY period DESC"

    with engine.connect() as conn:
        r = conn.execute(text(q))
        periods = [x[0] for x in r]

    return {"periods": periods}


# ---------- DATA ENDPOINTS ----------

@data_router.get("/select_by_period/{period}")
def all_data(period: str):
    if period == 'latest':
        q = "SELECT period, metric, nominal, mom_change, yoy_change FROM financials WHERE period = (select max(period) FROM financials)"
    else:
        q = "SELECT period, metric, nominal, mom_change, yoy_change FROM financials WHERE period = :period"

    with engine.connect() as conn:
        r = conn.execute(text(q), {"period": period})
        rows = [dict(x._mapping) for x in r]

    return {"nodes": rows}

@data_router.get("/all_formulas")
def all_formulas():
    q = "SELECT id, parent_metric as target, child_metric as source, operation FROM calculation_formulas"

    with engine.connect() as conn:
        r = conn.execute(text(q))
        rows = [dict(x._mapping) for x in r]

    return {"formulas": rows}
