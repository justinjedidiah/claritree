from db import engine
from sqlalchemy import text

create_sql_statements = ["""
CREATE OR REPLACE TABLE financials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT,
    metric TEXT,
    nominal REAL,
    mom_change REAL,
    yoy_change REAL
);""", """
CREATE OR REPLACE TABLE calculation_formulas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_metric TEXT,
    child_metric TEXT,
    operation TEXT
);
"""]

with engine.connect() as conn:
    for create_sql in create_sql_statements:
        conn.execute(text(create_sql))
        conn.commit()

print("Tables created.")
