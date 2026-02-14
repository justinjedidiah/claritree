from db import engine
from sqlalchemy import text

create_sql_statements = ["""
CREATE TABLE IF NOT EXISTS financials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT,
    metric TEXT,
    nominal REAL
);""", """
CREATE TABLE IF NOT EXISTS calculation_formulas(
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
