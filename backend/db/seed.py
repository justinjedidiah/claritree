"""
seed.py — Claritree financial data seed
========================================
Periods  : 2024-01 → 2026-04
Stores   : STORE_JKT (Jakarta), STORE_BDG (Bandung), STORE_SBY (Surabaya) + CENTRAL
Segments : B2B, B2C — revenue accounts only, handled inside each generator

Data stories
------------
1. Software licenses accelerating across all stores        [subtle]
2. Hardware sales peak → decline at SBY                   [dramatic]
3. B2B growing faster than B2C at BDG                     [subtle]
4. Consulting spike at JKT in Q3 2024 (big project)       [dramatic]
5. Print ads dying, digital ads rising                     [obvious]
6. SBY rent locked while revenue falls → margin squeeze    [subtle]
7. Accounts receivable deteriorating at SBY                [subtle BS]
"""

import math
import random
from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy import text
from db import engine

random.seed(42)


# ── periods ───────────────────────────────────────────────────────────────────

def gen_periods(start: str, end: str) -> list[str]:
    """Return list of 'YYYY-MM' strings inclusive."""
    sy, sm = map(int, start.split('-'))
    ey, em = map(int, end.split('-'))
    periods, y, m = [], sy, sm
    while (y, m) <= (ey, em):
        periods.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return periods

PERIODS = gen_periods("2024-01", "2026-04")

def t(period: str) -> int:
    """Time index: t=0 is 2024-01."""
    return PERIODS.index(period)

def periods_in_range(start: str, end: str) -> list[str]:
    return [p for p in PERIODS if start <= p <= end]

def quarter_start(period: str) -> str:
    y, m = map(int, period.split('-'))
    return f"{y:04d}-{((m - 1) // 3) * 3 + 1:02d}"

def year_start(period: str) -> str:
    return period[:4] + "-01"

def prev_month(period: str) -> str:
    y, m = map(int, period.split('-'))
    d = date(y, m, 1) - relativedelta(months=1)
    return f"{d.year:04d}-{d.month:02d}"

def prev_quarter(period: str) -> str:
    y, m = map(int, period.split('-'))
    
    # Floor the month to the last month of the previous quarter
    prev_m = ((m - 1) // 3) * 3
    
    # Handle the year roll-back if the previous quarter was Q4 of last year
    if prev_m == 0:
        prev_m = 12
        y -= 1
        
    return f"{y:04d}-{prev_m:02d}"

def prev_year(period: str) -> str:
    y, m = map(int, period.split('-'))
    return f"{y - 1:04d}-{m:02d}"


# ── story helpers ─────────────────────────────────────────────────────────────

def sigmoid_decline(ti: float, inflection: float, steepness: float = 0.3) -> float:
    """Smooth S-curve: 1.0 before inflection, falls toward 0 after."""
    return 1 / (1 + math.exp(steepness * (ti - inflection)))

def spike(ti: float, center: float, width: float = 2.0, height: float = 1.0) -> float:
    """Gaussian bump centered at ti=center."""
    return height * math.exp(-((ti - center) ** 2) / (2 * width ** 2))

def grow(ti: float, monthly_rate: float) -> float:
    """Compound growth multiplier from t=0."""
    return (1 + monthly_rate) ** ti

def noise(amplitude: float) -> float:
    return random.uniform(-amplitude, amplitude)

def seasonal(period: str, amplitude: float = 0.05) -> float:
    """Peaks Q4, troughs Q1."""
    m = int(period.split('-')[1])
    return 1 + amplitude * math.sin(2 * math.pi * (m - 3) / 12)


# ── reference data ────────────────────────────────────────────────────────────

COST_CENTERS = [
    # (code,         name,              type,       region)
    ("STORE_JKT",  "Jakarta Store",   "store",    "jakarta"),
    ("STORE_BDG",  "Bandung Store",   "store",    "west_java"),
    ("STORE_SBY",  "Surabaya Store",  "store",    "east_java"),
    ("CENTRAL",    "Central / HQ",    "central",  None),
]

STORE_CODES = [cc[0] for cc in COST_CENTERS if cc[2] == "store"]

# (coa_code, name, statement_type)
COA_ACCOUNTS = [
    # P&L — Revenue
    ("4001", "Hardware Sales",        "pl"),
    ("4002", "Software Licenses",     "pl"),
    ("4003", "Consulting Revenue",    "pl"),
    ("4004", "Support Contracts",     "pl"),
    # P&L — COGS
    ("5001", "Raw Materials",         "pl"),
    ("5002", "Packaging",             "pl"),
    ("5003", "Shipping",              "pl"),
    ("5004", "Warehousing",           "pl"),
    # P&L — Store Opex
    ("6001", "Store Rent",            "pl"),
    ("6002", "Store Utilities",       "pl"),
    ("6003", "Store Staff Salaries",  "pl"),
    # P&L — Central Opex
    ("7001", "IT Infrastructure",     "pl"),
    ("7002", "Engineering Salaries",  "pl"),
    ("7003", "Ops Salaries",          "pl"),
    ("7004", "Digital Advertising",   "pl"),
    ("7005", "Print Advertising",     "pl"),
    ("7006", "Discounts",             "pl"),
    ("7007", "Events",                "pl"),
    ("7008", "Office Rent",           "pl"),
    ("7009", "Equipment Lease",       "pl"),
    # Balance Sheet — Assets
    ("1001", "Accounts Receivable",   "bs"),
    ("1002", "Inventory",             "bs"),
    ("1003", "Fixed Assets",          "bs"),
    # Balance Sheet — Liabilities
    ("2001", "Accounts Payable",      "bs"),
    ("2002", "Short-term Debt",       "bs"),
]

METRIC_DEFINITIONS = [
    # (metric_name, statement_type)
    ("profit",            "pl"),
    ("gross_profit",      "pl"),
    ("revenue",           "pl"),
    ("product_revenue",   "pl"),
    ("service_revenue",   "pl"),
    ("cogs",              "pl"),
    ("material_cost",     "pl"),
    ("logistics_cost",    "pl"),
    ("operating_expense", "pl"),
    ("store_opex",        "pl"),
    ("marketing",         "pl"),
    ("ads",               "pl"),
    ("promotions",        "pl"),
    ("admin",             "pl"),
    ("salaries",          "pl"),
    ("rent",              "pl"),
    ("total_assets",      "bs"),
    ("total_liabilities", "bs"),
]

# Traversal order matters: leaves first, root last.
# (parent_metric, child_metric, child_type, operation)
CALCULATION_FORMULAS = [
    # product_revenue — COA leaves
    ("product_revenue",   "4001", "coa", "+"),
    ("product_revenue",   "4002", "coa", "+"),
    # service_revenue — COA leaves
    ("service_revenue",   "4003", "coa", "+"),
    ("service_revenue",   "4004", "coa", "+"),
    # revenue
    ("revenue",           "product_revenue", "metric", "+"),
    ("revenue",           "service_revenue", "metric", "+"),
    # material_cost — COA leaves
    ("material_cost",     "5001", "coa", "+"),
    ("material_cost",     "5002", "coa", "+"),
    # logistics_cost — COA leaves
    ("logistics_cost",    "5003", "coa", "+"),
    ("logistics_cost",    "5004", "coa", "+"),
    # cogs
    ("cogs",              "material_cost",  "metric", "+"),
    ("cogs",              "logistics_cost", "metric", "+"),
    # gross_profit
    ("gross_profit",      "revenue",        "metric", "+"),
    ("gross_profit",      "cogs",           "metric", "-"),
    # store_opex — COA leaves
    ("store_opex",        "6001", "coa", "+"),
    ("store_opex",        "6002", "coa", "+"),
    ("store_opex",        "6003", "coa", "+"),
    # ads — COA leaves (central)
    ("ads",               "7004", "coa", "+"),
    ("ads",               "7005", "coa", "+"),
    # promotions — COA leaves (central)
    ("promotions",        "7006", "coa", "+"),
    ("promotions",        "7007", "coa", "+"),
    # marketing
    ("marketing",         "ads",        "metric", "+"),
    ("marketing",         "promotions", "metric", "+"),
    # salaries — COA leaves (central)
    ("salaries",          "7002", "coa", "+"),
    ("salaries",          "7003", "coa", "+"),
    # rent — COA leaves (central)
    ("rent",              "7008", "coa", "+"),
    ("rent",              "7009", "coa", "+"),
    # admin
    ("admin",             "salaries",  "metric", "+"),
    ("admin",             "rent",      "metric", "+"),
    ("admin",             "7001",      "coa",    "+"),
    # operating_expense
    ("operating_expense", "store_opex", "metric", "+"),
    ("operating_expense", "marketing",  "metric", "+"),
    ("operating_expense", "admin",      "metric", "+"),
    # profit (root)
    ("profit",            "gross_profit",      "metric", "+"),
    ("profit",            "operating_expense", "metric", "-"),
    # balance sheet
    ("total_assets",      "1001", "coa", "+"),
    ("total_assets",      "1002", "coa", "+"),
    ("total_assets",      "1003", "coa", "+"),
    ("total_liabilities", "2001", "coa", "+"),
    ("total_liabilities", "2002", "coa", "+"),
]

REPORTS = [
    # (name, description, statement_type)
    ("P&L Summary",       "Top-level profit and loss overview",        "pl"),
    ("Revenue Breakdown", "Detailed breakdown of all revenue streams", "pl"),
    ("Cost Analysis",     "COGS and operational cost breakdown",       "pl"),
    ("Marketing Report",  "Marketing spend and campaign performance",  "pl"),
    ("HR & Admin Report", "Salary and administrative cost tracking",   "pl"),
    ("Balance Sheet",     "Assets and liabilities snapshot",           "bs"),
]

# (metric, report_name, display_order)
METRIC_REPORTS = [
    ("profit",            "P&L Summary", 1),
    ("gross_profit",      "P&L Summary", 2),
    ("revenue",           "P&L Summary", 3),
    ("cogs",              "P&L Summary", 4),
    ("operating_expense", "P&L Summary", 5),

    ("revenue",           "Revenue Breakdown", 1),
    ("product_revenue",   "Revenue Breakdown", 2),
    ("service_revenue",   "Revenue Breakdown", 3),

    ("cogs",              "Cost Analysis", 1),
    ("material_cost",     "Cost Analysis", 2),
    ("logistics_cost",    "Cost Analysis", 3),
    ("operating_expense", "Cost Analysis", 4),
    ("store_opex",        "Cost Analysis", 5),

    ("marketing",         "Marketing Report", 1),
    ("ads",               "Marketing Report", 2),
    ("promotions",        "Marketing Report", 3),

    ("admin",             "HR & Admin Report", 1),
    ("salaries",          "HR & Admin Report", 2),
    ("rent",              "HR & Admin Report", 3),

    ("total_assets",      "Balance Sheet", 1),
    ("total_liabilities", "Balance Sheet", 2),
]

# Central-only COA codes — no RCC, no segment
CENTRAL_ONLY = {"7001", "7002", "7003", "7004", "7005", "7006", "7007", "7008", "7009"}


# ── generators ────────────────────────────────────────────────────────────────
# Signature: (period, rcc) → list of (segment, value)
# Non-segmented accounts return [(None, value)]
# Segmented accounts return [("B2B", value), ("B2C", value)]
# Central generators receive rcc=None.

def gen_hardware_sales(period: str, rcc: str) -> list:
    """
    Story 2: SBY peaks mid-2024 then declines dramatically.
    Story 3: B2B growing faster than B2C at BDG.
    """
    ti   = t(period)
    base = {"STORE_JKT": 30000, "STORE_BDG": 18000, "STORE_SBY": 25000}[rcc]

    if rcc == "STORE_SBY":
        total = (base + spike(ti, center=6, width=3, height=8000)) \
                * sigmoid_decline(ti, inflection=8, steepness=0.25) \
                * seasonal(period, 0.08)
    elif rcc == "STORE_BDG":
        total = base * grow(ti, 0.012) * seasonal(period, 0.06)
    else:
        total = base * grow(ti, 0.005) * seasonal(period, 0.07)

    total = max(total + noise(1500), 500)

    # B2B ratio: BDG shifts toward B2B over time (story 3)
    b2b_base = {"STORE_JKT": 0.45, "STORE_BDG": 0.30, "STORE_SBY": 0.40}[rcc]
    b2b_rate = {"STORE_JKT": 0.001, "STORE_BDG": 0.004, "STORE_SBY": 0.001}[rcc]
    b2b_frac = min(b2b_base + b2b_rate * ti, 0.75)

    return [("B2B", round(total * b2b_frac, 2)),
            ("B2C", round(total * (1 - b2b_frac), 2))]


def gen_software_licenses(period: str, rcc: str) -> list:
    """Story 1: Subtle acceleration — SaaS momentum building across all stores."""
    ti   = t(period)
    base = {"STORE_JKT": 15000, "STORE_BDG": 8000, "STORE_SBY": 10000}[rcc]
    # rate itself increases over time → acceleration
    rate  = 0.008 + 0.0003 * ti
    total = max(base * grow(ti, rate) * seasonal(period, 0.04) + noise(600), 200)

    b2b_frac = {"STORE_JKT": 0.60, "STORE_BDG": 0.50, "STORE_SBY": 0.55}[rcc]
    return [("B2B", round(total * b2b_frac, 2)),
            ("B2C", round(total * (1 - b2b_frac), 2))]


def gen_consulting(period: str, rcc: str) -> list:
    """Story 4: JKT lands a big project in Q3 2024 — spike then normalises."""
    ti   = t(period)
    base = {"STORE_JKT": 10000, "STORE_BDG": 5000, "STORE_SBY": 4000}[rcc]

    if rcc == "STORE_JKT":
        total = base * grow(ti, 0.004) + spike(ti, center=7, width=1.5, height=18000)
    else:
        total = base * grow(ti, 0.004)

    total = max(total + noise(800), 100)

    # Consulting is mostly B2B
    b2b_frac = {"STORE_JKT": 0.80, "STORE_BDG": 0.75, "STORE_SBY": 0.70}[rcc]
    return [("B2B", round(total * b2b_frac, 2)),
            ("B2C", round(total * (1 - b2b_frac), 2))]


def gen_support_contracts(period: str, rcc: str) -> list:
    ti   = t(period)
    base = {"STORE_JKT": 7000, "STORE_BDG": 3500, "STORE_SBY": 5000}[rcc]
    total = max(base * grow(ti, 0.007) + noise(400), 100)

    b2b_frac = {"STORE_JKT": 0.65, "STORE_BDG": 0.60, "STORE_SBY": 0.60}[rcc]
    return [("B2B", round(total * b2b_frac, 2)),
            ("B2C", round(total * (1 - b2b_frac), 2))]


def gen_raw_materials(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 6000, "STORE_BDG": 3500, "STORE_SBY": 5000}[rcc]
    value = max(base * grow(ti, 0.003) * seasonal(period, 0.05) + noise(400), 100)
    return [(None, round(value, 2))]


def gen_packaging(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 2000, "STORE_BDG": 1200, "STORE_SBY": 1800}[rcc]
    value = max(base * grow(ti, 0.002) + noise(150), 50)
    return [(None, round(value, 2))]


def gen_shipping(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 3500, "STORE_BDG": 2000, "STORE_SBY": 3000}[rcc]
    value = max(base * grow(ti, 0.004) * seasonal(period, 0.06) + noise(300), 100)
    return [(None, round(value, 2))]


def gen_warehousing(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 2800, "STORE_BDG": 1500, "STORE_SBY": 2200}[rcc]
    value = max(base * grow(ti, 0.002) + noise(200), 100)
    return [(None, round(value, 2))]


def gen_store_rent(period: str, rcc: str) -> list:
    """Story 6: SBY rent locked in while revenue declines → margin squeeze."""
    ti   = t(period)
    base = {"STORE_JKT": 5000, "STORE_BDG": 3000, "STORE_SBY": 4500}[rcc]
    if rcc == "STORE_SBY":
        value = base + noise(50)   # locked
    else:
        value = max(base * grow(ti, 0.002) + noise(100), 500)
    return [(None, round(value, 2))]


def gen_store_utilities(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 1200, "STORE_BDG": 800, "STORE_SBY": 1000}[rcc]
    value = max(base * grow(ti, 0.002) * seasonal(period, 0.10) + noise(100), 100)
    return [(None, round(value, 2))]


def gen_store_staff(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 8000, "STORE_BDG": 5000, "STORE_SBY": 6500}[rcc]
    value = max(base * grow(ti, 0.005) + noise(300), 500)
    return [(None, round(value, 2))]


def gen_it_infrastructure(period: str, rcc: str) -> list:
    ti    = t(period)
    value = max(8000 * grow(ti, 0.004) + noise(400), 500)
    return [(None, round(value, 2))]


def gen_engineering_salaries(period: str, rcc: str) -> list:
    ti    = t(period)
    value = max(12000 * grow(ti, 0.006) + noise(500), 1000)
    return [(None, round(value, 2))]


def gen_ops_salaries(period: str, rcc: str) -> list:
    ti    = t(period)
    value = max(9000 * grow(ti, 0.004) + noise(400), 1000)
    return [(None, round(value, 2))]


def gen_digital_ads(period: str, rcc: str) -> list:
    """Story 5: Digital ads rising steadily."""
    ti    = t(period)
    value = max(5000 * grow(ti, 0.015) + noise(500), 200)
    return [(None, round(value, 2))]


def gen_print_ads(period: str, rcc: str) -> list:
    """Story 5: Print ads declining — obvious divergence from digital."""
    ti    = t(period)
    value = max(4000 * grow(ti, -0.018) + noise(300), 100)
    return [(None, round(value, 2))]


def gen_discounts(period: str, rcc: str) -> list:
    ti    = t(period)
    value = max(2500 * grow(ti, 0.003) + noise(200), 100)
    return [(None, round(value, 2))]


def gen_events(period: str, rcc: str) -> list:
    ti    = t(period)
    value = max(1200 * grow(ti, 0.002) + noise(150), 50)
    return [(None, round(value, 2))]


def gen_office_rent(period: str, rcc: str) -> list:
    value = max(4500 + noise(80), 500)
    return [(None, round(value, 2))]


def gen_equipment_lease(period: str, rcc: str) -> list:
    ti    = t(period)
    value = max(2000 * grow(ti, 0.001) + noise(80), 200)
    return [(None, round(value, 2))]


def gen_accounts_receivable(period: str, rcc: str) -> list:
    """Story 7: SBY AR building up — collections slipping."""
    ti   = t(period)
    base = {"STORE_JKT": 15000, "STORE_BDG": 9000, "STORE_SBY": 12000}[rcc]
    rate = {"STORE_JKT": 0.005, "STORE_BDG": 0.005, "STORE_SBY": 0.022}[rcc]
    value = max(base * grow(ti, rate) + noise(800), 1000)
    return [(None, round(value, 2))]


def gen_inventory(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 20000, "STORE_BDG": 12000, "STORE_SBY": 18000}[rcc]
    value = max(base * grow(ti, 0.003) * seasonal(period, 0.08) + noise(1000), 1000)
    return [(None, round(value, 2))]


def gen_fixed_assets(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 80000, "STORE_BDG": 50000, "STORE_SBY": 60000}[rcc]
    value = max(base * grow(ti, 0.002) + noise(500), 5000)
    return [(None, round(value, 2))]


def gen_accounts_payable(period: str, rcc: str) -> list:
    ti    = t(period)
    base  = {"STORE_JKT": 10000, "STORE_BDG": 6000, "STORE_SBY": 9000}[rcc]
    value = max(base * grow(ti, 0.004) + noise(500), 500)
    return [(None, round(value, 2))]


def gen_short_term_debt(period: str, rcc: str) -> list:
    """SBY taking on more debt as cash flow weakens."""
    ti   = t(period)
    base = {"STORE_JKT": 5000, "STORE_BDG": 8000, "STORE_SBY": 12000}[rcc]
    rate = {"STORE_JKT": 0.001, "STORE_BDG": 0.005, "STORE_SBY": 0.018}[rcc]
    value = max(base * grow(ti, rate) + noise(400), 0)
    return [(None, round(value, 2))]


# Maps coa_code → generator function
COA_GENERATORS = {
    "4001": gen_hardware_sales,
    "4002": gen_software_licenses,
    "4003": gen_consulting,
    "4004": gen_support_contracts,
    "5001": gen_raw_materials,
    "5002": gen_packaging,
    "5003": gen_shipping,
    "5004": gen_warehousing,
    "6001": gen_store_rent,
    "6002": gen_store_utilities,
    "6003": gen_store_staff,
    "7001": gen_it_infrastructure,
    "7002": gen_engineering_salaries,
    "7003": gen_ops_salaries,
    "7004": gen_digital_ads,
    "7005": gen_print_ads,
    "7006": gen_discounts,
    "7007": gen_events,
    "7008": gen_office_rent,
    "7009": gen_equipment_lease,
    "1001": gen_accounts_receivable,
    "1002": gen_inventory,
    "1003": gen_fixed_assets,
    "2001": gen_accounts_payable,
    "2002": gen_short_term_debt,
}


# ── part 1: build coa rows ────────────────────────────────────────────────────

def build_coa_rows() -> list[dict]:
    rows = []
    for coa_code, _, _ in COA_ACCOUNTS:
        gen = COA_GENERATORS[coa_code]
        is_central = coa_code in CENTRAL_ONLY

        for period in PERIODS:
            if is_central:
                for segment, value in gen(period, None):
                    rows.append({"period": period, "coa_code": coa_code,
                                 "rcc": None, "segment": segment, "nominal": value})
            else:
                for rcc in STORE_CODES:
                    for segment, value in gen(period, rcc):
                        rows.append({"period": period, "coa_code": coa_code,
                                     "rcc": rcc, "segment": segment, "nominal": value})
    return rows


# ── part 2: index coa values ──────────────────────────────────────────────────

def index_coa_values(coa_rows: list[dict]) -> dict:
    """
    Flat index: (period, coa_code, rcc, segment) → nominal.
    Also builds consolidated entries:
      (period, coa_code, rcc, None)  → sum across segments for that rcc
      (period, coa_code, None, None) → sum across all rcc and segments
    """

    # per-rcc totals (segment=None) for segmented accounts
    from collections import defaultdict
    index = {}
    by_rcc   = defaultdict(float)
    by_total = defaultdict(float)

    for r in coa_rows:
        index[(r["period"], r["coa_code"], r["rcc"], r["segment"])] = r["nominal"]
        by_rcc[(r["period"], r["coa_code"], r["rcc"])] += r["nominal"]
        by_total[(r["period"], r["coa_code"])] += r["nominal"]

    for (period, coa_code, rcc), val in by_rcc.items():
        k = (period, coa_code, rcc, None)
        if k not in index:
            index[k] = val

    for (period, coa_code), val in by_total.items():
        k = (period, coa_code, None, None)
        if k not in index:
            index[k] = val

    return index


# ── part 3: compute metrics (bottom-up traversal) ─────────────────────────────

def compute_metrics(coa_index: dict) -> dict:
    """
    Walk CALCULATION_FORMULAS in declared order (leaves first, root last).
    For each formula: look up child value from coa_index or already-computed
    metric_index, apply sign, accumulate into parent.

    Returns metric_index: (period, metric, rcc, segment) → nominal
    """

    # all dimension combos to compute
    dim_combos = [(None, None)]
    for rcc in STORE_CODES:
        dim_combos.append((rcc, None))
        dim_combos.append((rcc, "B2B"))
        dim_combos.append((rcc, "B2C"))

    metric_index: dict = {}

    for parent, child_metric, child_type, operation in CALCULATION_FORMULAS:
        sign = 1 if operation == "+" else -1

        for period in PERIODS:
            for rcc, segment in dim_combos:
                # look up child value
                if child_type == "coa":
                    child_val = coa_index.get((period, child_metric, rcc, segment), 0.0)
                else:
                    child_val = metric_index.get((period, child_metric, rcc, segment), 0.0)

                key = (period, parent, rcc, segment)
                metric_index[key] = metric_index.get(key, 0.0) + sign * child_val

    return metric_index


# ── part 4: expand period types ───────────────────────────────────────────────

def expand_period_types(metric_index: dict, coa_index: dict) -> list[dict]:
    """
    For each (period, metric, rcc, segment):
    - BS → balance
    - PL → mtd, qtd, ytd
    """
    metric_st = {m: st for m, st in METRIC_DEFINITIONS}
    coa_st = {m: st for m, _, st in COA_ACCOUNTS}
    all_st = metric_st | coa_st
    rows = []

    # group by (metric, rcc, segment) → sorted list of (period, nominal)
    from collections import defaultdict
    series: dict = defaultdict(dict)
    for (period, metric, rcc, segment), nominal in metric_index.items():
        series[(metric, rcc, segment)][period] = nominal
    for (period, coa, rcc, segment), nominal in coa_index.items():
        series[(coa, rcc, segment)][period] = nominal

    for (metric, rcc, segment), period_map in series.items():
        st = all_st[metric]

        for period in PERIODS:
            nominal = period_map.get(period, 0.0)

            if st == "bs":
                rows.append({"period": period, "metric": metric,
                             "rcc": rcc, "segment": segment,
                             "mtd": None, "qtd": None, "ytd": None,
                             "balance": nominal,
                             "mom_change": None, "qoq_change": None, "yoy_change": None})
            else:
                qs  = quarter_start(period)
                ys  = year_start(period)
                qtd = sum(period_map.get(p, 0.0) for p in periods_in_range(qs, period))
                ytd = sum(period_map.get(p, 0.0) for p in periods_in_range(ys, period))
                rows.append({"period": period, "metric": metric,
                             "rcc": rcc, "segment": segment,
                             "mtd": nominal, "qtd": qtd, "ytd": ytd,
                             "balance": None,
                             "mom_change": None, "qoq_change": None, "yoy_change": None})
    return rows


# ── part 5: attach mom / yoy changes ─────────────────────────────────────────

def attach_changes(rows: list[dict]) -> list[dict]:
    """
    Post-processing pass. Computes MoM and YoY per (metric, rcc, segment).
    """
    lookup = {
        (r["metric"], r["rcc"], r["segment"], r["period"]): (r["mtd"], r["qtd"], r["ytd"], r["balance"])
        for r in rows
    }

    for r in rows:
        k = (r["metric"], r["rcc"], r["segment"])

        if pm := lookup.get((*k, prev_month(r["period"]))):
            pm_value = pm[0] if pm[3] is None else pm[3]
        else:
            pm_value = None

        if pq := lookup.get((*k, prev_quarter(r["period"]))):
            pq_value = pq[1] if pq[3] is None else pq[3]
        else:
            pq_value = None

        if py := lookup.get((*k, prev_year(r["period"]))):
            py_value = py[2] if py[3] is None else py[3]
        else:
            py_value = None

        curr = (r["mtd"], r["qtd"], r["ytd"], r["balance"])

        r["mom_change"] = (curr[0] - pm_value) / pm_value if pm_value and curr[0] else None
        r["qoq_change"] = (curr[1] - pq_value) / pq_value if pq_value and curr[1] else None
        r["yoy_change"] = (curr[2] - py_value) / py_value if py_value and curr[2] else None

    return rows


# ── part 6: write to db ───────────────────────────────────────────────────────

def run():
    print("Building COA rows...")
    coa_rows = build_coa_rows()
    print(f"  {len(coa_rows):,} coa_values rows")

    print("Indexing COA values...")
    coa_index = index_coa_values(coa_rows)

    print("Computing metrics (bottom-up traversal)...")
    metric_index = compute_metrics(coa_index)

    print("Expanding period types...")
    fin_rows = expand_period_types(metric_index, coa_index)

    print("Attaching MoM / YoY changes...")
    fin_rows = attach_changes(fin_rows)
    print(f"  {len(fin_rows):,} financials rows")

    print("Writing to DB...")
    with engine.connect() as conn:

        for tbl in ["metric_reports", "reports", "financials", "coa_values",
                    "calculation_formulas", "metric_definitions",
                    "coa_accounts", "cost_centers"]:
            conn.execute(text(f"DELETE FROM {tbl};"))

        conn.execute(
            text("INSERT INTO cost_centers (code, name, type, region) VALUES (:code, :name, :type, :region)"),
            [{"code": c, "name": n, "type": tp, "region": r} for c, n, tp, r in COST_CENTERS]
        )

        conn.execute(
            text("INSERT INTO coa_accounts (coa_code, name, statement_type) VALUES (:coa_code, :name, :statement_type)"),
            [{"coa_code": c, "name": n, "statement_type": st} for c, n, st in COA_ACCOUNTS]
        )

        conn.execute(
            text("INSERT INTO metric_definitions (metric_name, statement_type) VALUES (:metric_name, :statement_type)"),
            [{"metric_name": m, "statement_type": st} for m, st in METRIC_DEFINITIONS]
        )

        conn.execute(
            text("INSERT INTO calculation_formulas (parent_metric, child_metric, child_type, operation) VALUES (:parent_metric, :child_metric, :child_type, :operation)"),
            [{"parent_metric": p, "child_metric": c, "child_type": ct, "operation": op}
             for p, c, ct, op in CALCULATION_FORMULAS]
        )

        conn.execute(
            text("INSERT INTO coa_values (period, coa_code, rcc, segment, nominal) VALUES (:period, :coa_code, :rcc, :segment, :nominal)"),
            coa_rows
        )

        report_ids = {}
        for name, desc, st in REPORTS:
            r = conn.execute(
                text("INSERT INTO reports (name, description, statement_type) VALUES (:name, :desc, :st)"),
                {"name": name, "desc": desc, "st": st}
            )
            report_ids[name] = r.lastrowid

        conn.execute(
            text("INSERT INTO metric_reports (metric, report_id, display_order) VALUES (:metric, :report_id, :display_order)"),
            [{"metric": m, "report_id": report_ids[rname], "display_order": order}
             for m, rname, order in METRIC_REPORTS]
        )

        conn.execute(
            text("""INSERT INTO financials
                    (period, metric, rcc, segment, mtd, qtd, ytd, balance, mom_change, qoq_change, yoy_change)
                    VALUES (:period, :metric, :rcc, :segment, :mtd, :qtd, :ytd, :balance, :mom_change, :qoq_change, :yoy_change)"""),
            fin_rows
        )

        conn.commit()

    print("Done.")
    print(f"  Periods : {PERIODS[0]} → {PERIODS[-1]} ({len(PERIODS)} months)")
    print(f"  Stores  : {', '.join(STORE_CODES)} + CENTRAL")
    print(f"  Stories : HW SBY decline | SW license acceleration | BDG B2B shift")
    print(f"            JKT consulting spike | print/digital divergence")
    print(f"            SBY margin squeeze | SBY AR deterioration")


if __name__ == "__main__":
    run()