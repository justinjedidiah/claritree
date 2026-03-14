import random
from sqlalchemy import text
from db import engine

# ── helpers ───────────────────────────────────────────────────────────────────

def gen_periods(start_year, start_month, end_year, end_month):
    """Generate list of 'YYYY-MM' strings inclusive."""
    periods = []
    y, m = start_year, start_month
    while (y, m) <= (end_year, end_month):
        periods.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return periods

PERIODS = gen_periods(2023, 1, 2026, 2)

# Base values for each leaf node — realistic starting points
LEAF_BASES = {
    # product_revenue children
    "hardware_sales":      28000,
    "software_licenses":   14000,
    # service_revenue children
    "consulting":          9000,
    "support_contracts":   6000,
    # material_cost children (cogs sub-level)
    "raw_materials":       5000,
    "packaging":           1800,
    # logistics_cost children
    "shipping":            3500,
    "warehousing":         2600,
    # ads children (marketing sub-level)
    "digital_ads":         2800,
    "print_ads":           1400,
    # promotions children
    "discounts":           1200,
    "events":              600,
    # salaries children (admin sub-level)
    "engineering_salaries": 5000,
    "ops_salaries":         4500,
    # rent children
    "office_rent":         2200,
    "equipment_lease":     1200,
}

# Per-metric growth trend (monthly multiplier) + noise amplitude
# trend > 1 = growing, < 1 = shrinking
LEAF_TRENDS = {
    "hardware_sales":       (1.008,  2000),
    "software_licenses":    (1.015,  1200),
    "consulting":           (1.005,  800),
    "support_contracts":    (1.010,  500),
    "raw_materials":        (1.003,  400),
    "packaging":            (1.002,  150),
    "shipping":             (1.004,  300),
    "warehousing":          (1.001,  200),
    "digital_ads":          (1.006,  400),
    "print_ads":            (0.998,  200),   # slight decline
    "discounts":            (1.003,  150),
    "events":               (1.002,  100),
    "engineering_salaries": (1.006,  300),
    "ops_salaries":         (1.004,  250),
    "office_rent":          (1.001,  100),
    "equipment_lease":      (1.000,  80),
}

random.seed(42)  # reproducible

def gen_leaf_values():
    """Returns list of (period, metric, nominal) tuples."""
    rows = []
    for metric, base in LEAF_BASES.items():
        trend, noise = LEAF_TRENDS[metric]
        value = float(base)
        for period in PERIODS:
            # apply trend + random noise
            value = value * trend + random.uniform(-noise, noise)
            value = max(value, 100)  # floor — never go negative
            rows.append((period, metric, round(value, 2)))
    return rows


# ── SQL ───────────────────────────────────────────────────────────────────────

CLEAR = [
    "DELETE FROM metric_reports;",
    "DELETE FROM reports;",
    "DELETE FROM financials;",
    "DELETE FROM leaf_nodes;",
    "DELETE FROM calculation_formulas;",
]

FORMULAS = """
INSERT INTO calculation_formulas (parent_metric, child_metric, operation) VALUES
-- profit
('profit', 'gross_profit', '+'),
('profit', 'operating_expense', '-'),

-- gross profit
('gross_profit', 'revenue', '+'),
('gross_profit', 'cogs', '-'),

-- revenue (depth 2)
('revenue', 'product_revenue', '+'),
('revenue', 'service_revenue', '+'),

-- product_revenue (depth 3)
('product_revenue', 'hardware_sales', '+'),
('product_revenue', 'software_licenses', '+'),

-- service_revenue (depth 3)
('service_revenue', 'consulting', '+'),
('service_revenue', 'support_contracts', '+'),

-- cogs (depth 2)
('cogs', 'material_cost', '+'),
('cogs', 'logistics_cost', '+'),

-- material_cost (depth 3)
('material_cost', 'raw_materials', '+'),
('material_cost', 'packaging', '+'),

-- logistics_cost (depth 3)
('logistics_cost', 'shipping', '+'),
('logistics_cost', 'warehousing', '+'),

-- operating_expense (depth 2)
('operating_expense', 'marketing', '+'),
('operating_expense', 'admin', '+'),

-- marketing (depth 3)
('marketing', 'ads', '+'),
('marketing', 'promotions', '+'),

-- ads (depth 4)
('ads', 'digital_ads', '+'),
('ads', 'print_ads', '+'),

-- promotions (depth 4)
('promotions', 'discounts', '+'),
('promotions', 'events', '+'),

-- admin (depth 3)
('admin', 'salaries', '+'),
('admin', 'rent', '+'),

-- salaries (depth 4)
('salaries', 'engineering_salaries', '+'),
('salaries', 'ops_salaries', '+'),

-- rent (depth 4)
('rent', 'office_rent', '+'),
('rent', 'equipment_lease', '+');
"""

REPORTS = """
INSERT INTO reports (name, description) VALUES
('P&L Summary',         'Top-level profit and loss overview'),
('Revenue Breakdown',   'Detailed breakdown of all revenue streams'),
('Cost Analysis',       'Breakdown of COGS and operational costs'),
('Marketing Report',    'Marketing spend and campaign performance'),
('HR & Admin Report',   'Salary and administrative cost tracking');
"""

METRIC_REPORTS = """
INSERT INTO metric_reports (metric, report_id) VALUES
-- P&L Summary (report 1) — top level metrics
('profit',             1),
('gross_profit',       1),
('revenue',            1),
('cogs',               1),
('operating_expense',  1),

-- Revenue Breakdown (report 2)
('revenue',            2),
('product_revenue',    2),
('service_revenue',    2),
('hardware_sales',     2),
('software_licenses',  2),
('consulting',         2),
('support_contracts',  2),

-- Cost Analysis (report 3)
('cogs',               3),
('material_cost',      3),
('logistics_cost',     3),
('raw_materials',      3),
('packaging',          3),
('shipping',           3),
('warehousing',        3),
('operating_expense',  3),

-- Marketing Report (report 4)
('marketing',          4),
('ads',                4),
('promotions',         4),
('digital_ads',        4),
('print_ads',          4),
('discounts',          4),
('events',             4),

-- HR & Admin Report (report 5)
('admin',              5),
('salaries',           5),
('rent',               5),
('engineering_salaries', 5),
('ops_salaries',       5),
('office_rent',        5),
('equipment_lease',    5);
"""

AGGREGATE = """
WITH RECURSIVE calculation_tree AS (
    SELECT ln.period, ln.metric AS parent_metric, '' AS child_metric, 1 AS num_operation, ln.nominal
    FROM leaf_nodes ln
    UNION ALL
    SELECT ct.period, cf.parent_metric, cf.child_metric,
        CASE WHEN cf.operation = '+' THEN ct.num_operation ELSE -ct.num_operation END AS num_operation,
        ct.nominal
    FROM calculation_formulas cf
    INNER JOIN calculation_tree ct ON cf.child_metric = ct.parent_metric
), aggregated AS (
    SELECT period, parent_metric AS metric,
           SUM(nominal * num_operation) AS nominal,
           NULL AS mom_change,
           NULL AS yoy_change
    FROM calculation_tree
    GROUP BY period, parent_metric
)
INSERT INTO financials
SELECT NULL AS id, a.* FROM aggregated a;
"""

UPDATE_CHANGES = """
WITH previous AS (
    SELECT
        curr.period, curr.metric,
        prev_m.nominal AS prev_month_nominal,
        prev_y.nominal AS prev_year_nominal
    FROM financials curr
    LEFT JOIN financials prev_m
        ON prev_m.metric = curr.metric
        AND prev_m.period = STRFTIME('%Y-%m', curr.period || '-01', '-1 month')
    LEFT JOIN financials prev_y
        ON prev_y.metric = curr.metric
        AND prev_y.period = STRFTIME('%Y-%m', curr.period || '-01', '-12 month')
)
UPDATE financials AS curr
SET mom_change = (curr.nominal - previous.prev_month_nominal) / NULLIF(previous.prev_month_nominal, 0),
    yoy_change = (curr.nominal - previous.prev_year_nominal)  / NULLIF(previous.prev_year_nominal, 0)
FROM previous
WHERE curr.metric = previous.metric AND curr.period = previous.period;
"""

# ── run ───────────────────────────────────────────────────────────────────────

with engine.connect() as conn:

    # clear
    for sql in CLEAR:
        conn.execute(text(sql))

    # formulas
    conn.execute(text(FORMULAS))

    # leaf nodes — generated by Python loop
    leaf_rows = gen_leaf_values()
    conn.execute(
        text("INSERT INTO leaf_nodes (period, metric, nominal) VALUES (:period, :metric, :nominal)"),
        [{"period": p, "metric": m, "nominal": n} for p, m, n in leaf_rows]
    )

    # reports
    conn.execute(text(REPORTS))
    conn.execute(text(METRIC_REPORTS))

    # aggregate into financials
    conn.execute(text(AGGREGATE))

    # compute mom/yoy
    conn.execute(text(UPDATE_CHANGES))

    conn.commit()

print(f"Seeded {len(PERIODS)} periods × {len(LEAF_BASES)} leaf metrics = {len(leaf_rows)} leaf rows.")
print(f"Reports and metric_reports populated.")
