from db import engine
from sqlalchemy import text

create_sql_statements = ["""
DROP TABLE IF EXISTS financials;
""","""
CREATE TABLE financials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT,
    metric TEXT,
    nominal REAL,
    mom_change REAL,
    yoy_change REAL
);
""","""
DROP TABLE IF EXISTS calculation_formulas;
""","""
CREATE TABLE calculation_formulas(
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
