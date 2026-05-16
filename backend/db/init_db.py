from db import engine
from sqlalchemy import text

create_sql_statements = [

# ── drop in FK dependency order ───────────────────────────────────────────────
"DROP TABLE IF EXISTS metric_reports;",
"DROP TABLE IF EXISTS reports;",
"DROP TABLE IF EXISTS financials;",
"DROP TABLE IF EXISTS coa_values;",
"DROP TABLE IF EXISTS calculation_formulas;",
"DROP TABLE IF EXISTS metric_definitions;",
"DROP TABLE IF EXISTS coa_accounts;",
"DROP TABLE IF EXISTS cost_centers;",

# ── cost_centers ──────────────────────────────────────────────────────────────
"""
CREATE TABLE cost_centers (
    code    TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    type    TEXT NOT NULL CHECK(type IN ('store', 'central')),
    region  TEXT
);
""",

# ── coa_accounts ──────────────────────────────────────────────────────────────
"""
CREATE TABLE coa_accounts (
    coa_code        TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    statement_type  TEXT NOT NULL CHECK(statement_type IN ('pl', 'bs'))
);
""",

# ── metric_definitions ────────────────────────────────────────────────────────
"""
CREATE TABLE metric_definitions (
    metric_name     TEXT PRIMARY KEY,
    statement_type  TEXT NOT NULL CHECK(statement_type IN ('pl', 'bs'))
);
""",

# ── calculation_formulas ──────────────────────────────────────────────────────
# child_type: 'metric' → look up in financials
#             'coa'    → look up in coa_values
"""
CREATE TABLE calculation_formulas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_metric TEXT NOT NULL,
    child_metric  TEXT NOT NULL,
    child_type    TEXT NOT NULL CHECK(child_type IN ('metric', 'coa')),
    operation     TEXT NOT NULL CHECK(operation IN ('+', '-'))
);
""",

# ── coa_values ────────────────────────────────────────────────────────────────
# Raw monthly actuals — source of truth, never modified after seeding.
# rcc:     NULL = central / not splittable by cost center
# segment: NULL = not segment-splittable
"""
CREATE TABLE coa_values (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    period                  TEXT NOT NULL,
    coa_code                TEXT NOT NULL,
    rcc                     TEXT,
    segment                 TEXT,
    nominal                 REAL NOT NULL,
    FOREIGN KEY (coa_code)  REFERENCES coa_accounts(coa_code),
    FOREIGN KEY (rcc)       REFERENCES cost_centers(code)
);
""",

# ── financials ────────────────────────────────────────────────────────────────
# Pre-computed serving layer for the UI.
# period:      always the ending month of the window (YYYY-MM)
# mtd:         value from start of the month until the end
# qtd:         value from the start of the quarter until period
# ytd:         value from 1 january all the way until period
# balance:     value for balance types metrics (like metrics in balance sheet)
# rcc:         NULL = consolidated across all cost centers
# segment:     NULL = all segments combined
# mom/yoy:     computed per period_type
"""
CREATE TABLE financials (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    period                  TEXT NOT NULL,
    metric                  TEXT NOT NULL,
    rcc                     TEXT,
    segment                 TEXT,
    mtd                     REAL,
    qtd                     REAL,
    ytd                     REAL,
    balance                 REAL,
    mom_change              REAL,
    qoq_change              REAL,
    yoy_change              REAL,
    FOREIGN KEY (metric)    REFERENCES metric_definitions(metric_name),
    FOREIGN KEY (rcc)       REFERENCES cost_centers(code)
);
""",

"""
CREATE INDEX idx_financials_lookup
ON financials(metric, period, rcc, segment);
""",

# ── reports ───────────────────────────────────────────────────────────────────
"""
CREATE TABLE reports (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    description    TEXT,
    statement_type TEXT NOT NULL CHECK(statement_type IN ('pl', 'bs', 'mixed'))
);
""",

# ── metric_reports ────────────────────────────────────────────────────────────
"""
CREATE TABLE metric_reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    metric        TEXT NOT NULL,
    report_id     INTEGER NOT NULL,
    display_order INTEGER,
    FOREIGN KEY (report_id) REFERENCES reports(id)
);
""",

]

with engine.connect() as conn:
    for sql in create_sql_statements:
        conn.execute(text(sql))
    conn.commit()

print("Tables created:")
print("  cost_centers")
print("  coa_accounts")
print("  metric_definitions")
print("  calculation_formulas")
print("  coa_values          <- raw monthly actuals (source of truth)")
print("  financials          <- pre-computed serving layer (all period types)")
print("  reports")
print("  metric_reports")