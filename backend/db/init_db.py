from db import engine
from sqlalchemy import text

create_sql_statements = [
"""DROP TABLE IF EXISTS metric_reports;""",
"""DROP TABLE IF EXISTS reports;""",
"""DROP TABLE IF EXISTS financials;""",
"""DROP TABLE IF EXISTS leaf_nodes;""",
"""DROP TABLE IF EXISTS calculation_formulas;""",

"""
CREATE TABLE financials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT,
    metric TEXT,
    nominal REAL,
    mom_change REAL,
    yoy_change REAL
);
""",

"""
CREATE TABLE leaf_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT,
    metric TEXT,
    nominal REAL
);
""",

"""
CREATE TABLE calculation_formulas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_metric TEXT,
    child_metric TEXT,
    operation TEXT
);
""",

"""
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
);
""",

"""
CREATE TABLE metric_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric TEXT NOT NULL,
    report_id INTEGER NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id)
);
""",
]

with engine.connect() as conn:
    for sql in create_sql_statements:
        conn.execute(text(sql))
        conn.commit()

print("Tables created.")
