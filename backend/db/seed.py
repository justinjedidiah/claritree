from sqlalchemy import create_engine, text

engine = create_engine("sqlite:///finance.db")

sql_statements = ["""
DELETE FROM financials;
""","""
DELETE FROM calculation_formulas;
""","""
INSERT INTO calculation_formulas (parent_metric, child_metric, operation) VALUES
-- profit
('profit','gross_profit','+'),
('profit','operating_expense','-'),

-- gross profit
('gross_profit','revenue','+'),
('gross_profit','cogs','-'),

-- revenue
('revenue','product_revenue','+'),
('revenue','service_revenue','+'),

-- cogs
('cogs','material_cost','+'),
('cogs','logistics_cost','+'),

-- operating expense
('operating_expense','marketing','+'),
('operating_expense','admin','+'),

-- marketing
('marketing','ads','+'),
('marketing','promotions','+'),

-- admin
('admin','salaries','+'),
('admin','rent','+');
""","""
INSERT INTO financials VALUES
(NULL,'2024-04','product_revenue',80000),
(NULL,'2024-04','service_revenue',20000),
(NULL,'2024-04','material_cost',30000),
(NULL,'2024-04','logistics_cost',10000),
(NULL,'2024-04','ads',8000),
(NULL,'2024-04','promotions',4000),
(NULL,'2024-04','salaries',15000),
(NULL,'2024-04','rent',5000);
""","""
INSERT INTO financials VALUES
(NULL,'2024-05','product_revenue',85000),
(NULL,'2024-05','service_revenue',22000),
(NULL,'2024-05','material_cost',32000),
(NULL,'2024-05','logistics_cost',11000),
(NULL,'2024-05','ads',9000),
(NULL,'2024-05','promotions',5000),
(NULL,'2024-05','salaries',15500),
(NULL,'2024-05','rent',5000);
"""
, # JUNE (anomaly month)
"""
INSERT INTO financials VALUES
(NULL,'2024-06','product_revenue',83000),
(NULL,'2024-06','service_revenue',21000),
(NULL,'2024-06','material_cost',34000),
(NULL,'2024-06','logistics_cost',12000),
(NULL,'2024-06','ads',15000),        -- big spike
(NULL,'2024-06','promotions',9000),  -- big spike
(NULL,'2024-06','salaries',16000),
(NULL,'2024-06','rent',5000);
"""]

with engine.connect() as conn:
    for sql_statement in sql_statements:
        conn.execute(text(sql_statement))
    conn.commit()

print("Seeded data.")
