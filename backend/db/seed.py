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
(NULL,'2023-01','product_revenue',32000,NULL),
(NULL,'2023-01','service_revenue',13500,NULL),
(NULL,'2023-01','material_cost',6700,NULL),
(NULL,'2023-01','logistics_cost',5900,NULL),
(NULL,'2023-01','ads',4000,NULL),
(NULL,'2023-01','promotions',1700,NULL),
(NULL,'2023-01','salaries',9000,NULL),
(NULL,'2023-01','rent',3300,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-02','product_revenue',31000,NULL),
(NULL,'2023-02','service_revenue',13500,NULL),
(NULL,'2023-02','material_cost',7700,NULL),
(NULL,'2023-02','logistics_cost',8900,NULL),
(NULL,'2023-02','ads',4400,NULL),
(NULL,'2023-02','promotions',1200,NULL),
(NULL,'2023-02','salaries',9200,NULL),
(NULL,'2023-02','rent',3300,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-03','product_revenue',29000,NULL),
(NULL,'2023-03','service_revenue',15500,NULL),
(NULL,'2023-03','material_cost',8200,NULL),
(NULL,'2023-03','logistics_cost',7100,NULL),
(NULL,'2023-03','ads',4900,NULL),
(NULL,'2023-03','promotions',1500,NULL),
(NULL,'2023-03','salaries',9500,NULL),
(NULL,'2023-03','rent',3200,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-04','product_revenue',30000,NULL),
(NULL,'2023-04','service_revenue',15500,NULL),
(NULL,'2023-04','material_cost',8500,NULL),
(NULL,'2023-04','logistics_cost',7400,NULL),
(NULL,'2023-04','ads',5900,NULL),
(NULL,'2023-04','promotions',1200,NULL),
(NULL,'2023-04','salaries',9600,NULL),
(NULL,'2023-04','rent',3400,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-05','product_revenue',32000,NULL),
(NULL,'2023-05','service_revenue',16500,NULL),
(NULL,'2023-05','material_cost',9200,NULL),
(NULL,'2023-05','logistics_cost',7200,NULL),
(NULL,'2023-05','ads',5500,NULL),
(NULL,'2023-05','promotions',1500,NULL),
(NULL,'2023-05','salaries',9200,NULL),
(NULL,'2023-05','rent',3200,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-06','product_revenue',35000,NULL),
(NULL,'2023-06','service_revenue',13500,NULL),
(NULL,'2023-06','material_cost',10200,NULL),
(NULL,'2023-06','logistics_cost',7200,NULL),
(NULL,'2023-06','ads',5000,NULL),
(NULL,'2023-06','promotions',1100,NULL),
(NULL,'2023-06','salaries',9500,NULL),
(NULL,'2023-06','rent',3200,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-01','product_revenue',52000,NULL),
(NULL,'2024-01','service_revenue',38500,NULL),
(NULL,'2024-01','material_cost',10700,NULL),
(NULL,'2024-01','logistics_cost',8900,NULL),
(NULL,'2024-01','ads',6400,NULL),
(NULL,'2024-01','promotions',2700,NULL),
(NULL,'2024-01','salaries',15000,NULL),
(NULL,'2024-01','rent',4300,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-02','product_revenue',72000,NULL),
(NULL,'2024-02','service_revenue',52000,NULL),
(NULL,'2024-02','material_cost',8000,NULL),
(NULL,'2024-02','logistics_cost',9500,NULL),
(NULL,'2024-02','ads',7400,NULL),
(NULL,'2024-02','promotions',2100,NULL),
(NULL,'2024-02','salaries',14700,NULL),
(NULL,'2024-02','rent',4300,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-03','product_revenue',82000,NULL),
(NULL,'2024-03','service_revenue',21000,NULL),
(NULL,'2024-03','material_cost',20500,NULL),
(NULL,'2024-03','logistics_cost',12000,NULL),
(NULL,'2024-03','ads',9000,NULL),
(NULL,'2024-03','promotions',3500,NULL),
(NULL,'2024-03','salaries',15200,NULL),
(NULL,'2024-03','rent',5000,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-04','product_revenue',80000,NULL),
(NULL,'2024-04','service_revenue',20000,NULL),
(NULL,'2024-04','material_cost',30000,NULL),
(NULL,'2024-04','logistics_cost',10000,NULL),
(NULL,'2024-04','ads',8000,NULL),
(NULL,'2024-04','promotions',4000,NULL),
(NULL,'2024-04','salaries',15000,NULL),
(NULL,'2024-04','rent',5000,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-05','product_revenue',85000,NULL),
(NULL,'2024-05','service_revenue',22000,NULL),
(NULL,'2024-05','material_cost',32000,NULL),
(NULL,'2024-05','logistics_cost',11000,NULL),
(NULL,'2024-05','ads',9000,NULL),
(NULL,'2024-05','promotions',5000,NULL),
(NULL,'2024-05','salaries',15500,NULL),
(NULL,'2024-05','rent',5100,NULL);
"""
, # JUNE (anomaly month)
"""
INSERT INTO financials VALUES
(NULL,'2024-06','product_revenue',83000,NULL),
(NULL,'2024-06','service_revenue',21000,NULL),
(NULL,'2024-06','material_cost',34000,NULL),
(NULL,'2024-06','logistics_cost',12000,NULL),
(NULL,'2024-06','ads',15000,NULL),        -- big spike
(NULL,'2024-06','promotions',9000,NULL),  -- big spike
(NULL,'2024-06','salaries',16000,NULL),
(NULL,'2024-06','rent',5000,NULL);
""",
"""
WITH previous_month AS (
    SELECT STRFTIME('%Y-%m', DATE(period||'-01','+1 month') AS period, metric, nominal
    FROM financials
), previous_year AS (
    SELECT STRFTIME('%Y-%m', DATE(period||'-01','+12 month') AS period, metric, nominal
    FROM financials
)
SELECT *
FROM financials curr
LEFT JOIN previous_month prev_month ON curr.metric = prev_month.metric AND curr.period = prev_month.period
LEFT JOIN previous_year prev_year ON curr.metric = prev_year.metric AND curr.period = prev_year.period
;
"""]

with engine.connect() as conn:
    for sql_statement in sql_statements:
        conn.execute(text(sql_statement))
    conn.commit()

print("Seeded data.")
