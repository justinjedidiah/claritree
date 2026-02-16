from sqlalchemy import text
from db import engine

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
(NULL,'2023-01','product_revenue',32000,NULL,NULL),
(NULL,'2023-01','service_revenue',13500,NULL,NULL),
(NULL,'2023-01','material_cost',6700,NULL,NULL),
(NULL,'2023-01','logistics_cost',5900,NULL,NULL),
(NULL,'2023-01','ads',4000,NULL,NULL),
(NULL,'2023-01','promotions',1700,NULL,NULL),
(NULL,'2023-01','salaries',9000,NULL,NULL),
(NULL,'2023-01','rent',3300,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-02','product_revenue',31000,NULL,NULL),
(NULL,'2023-02','service_revenue',13500,NULL,NULL),
(NULL,'2023-02','material_cost',7700,NULL,NULL),
(NULL,'2023-02','logistics_cost',8900,NULL,NULL),
(NULL,'2023-02','ads',4400,NULL,NULL),
(NULL,'2023-02','promotions',1200,NULL,NULL),
(NULL,'2023-02','salaries',9200,NULL,NULL),
(NULL,'2023-02','rent',3300,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-03','product_revenue',29000,NULL,NULL),
(NULL,'2023-03','service_revenue',15500,NULL,NULL),
(NULL,'2023-03','material_cost',8200,NULL,NULL),
(NULL,'2023-03','logistics_cost',7100,NULL,NULL),
(NULL,'2023-03','ads',4900,NULL,NULL),
(NULL,'2023-03','promotions',1500,NULL,NULL),
(NULL,'2023-03','salaries',9500,NULL,NULL),
(NULL,'2023-03','rent',3200,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-04','product_revenue',30000,NULL,NULL),
(NULL,'2023-04','service_revenue',15500,NULL,NULL),
(NULL,'2023-04','material_cost',8500,NULL,NULL),
(NULL,'2023-04','logistics_cost',7400,NULL,NULL),
(NULL,'2023-04','ads',5900,NULL,NULL),
(NULL,'2023-04','promotions',1200,NULL,NULL),
(NULL,'2023-04','salaries',9600,NULL,NULL),
(NULL,'2023-04','rent',3400,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-05','product_revenue',32000,NULL,NULL),
(NULL,'2023-05','service_revenue',16500,NULL,NULL),
(NULL,'2023-05','material_cost',9200,NULL,NULL),
(NULL,'2023-05','logistics_cost',7200,NULL,NULL),
(NULL,'2023-05','ads',5500,NULL,NULL),
(NULL,'2023-05','promotions',1500,NULL,NULL),
(NULL,'2023-05','salaries',9200,NULL,NULL),
(NULL,'2023-05','rent',3200,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-06','product_revenue',35000,NULL,NULL),
(NULL,'2023-06','service_revenue',13500,NULL,NULL),
(NULL,'2023-06','material_cost',10200,NULL,NULL),
(NULL,'2023-06','logistics_cost',7200,NULL,NULL),
(NULL,'2023-06','ads',5000,NULL,NULL),
(NULL,'2023-06','promotions',1100,NULL,NULL),
(NULL,'2023-06','salaries',9500,NULL,NULL),
(NULL,'2023-06','rent',3200,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-07','product_revenue',37000,NULL,NULL),
(NULL,'2023-07','service_revenue',14500,NULL,NULL),
(NULL,'2023-07','material_cost',12200,NULL,NULL),
(NULL,'2023-07','logistics_cost',7500,NULL,NULL),
(NULL,'2023-07','ads',10000,NULL,NULL),
(NULL,'2023-07','promotions',1200,NULL,NULL),
(NULL,'2023-07','salaries',9700,NULL,NULL),
(NULL,'2023-07','rent',3200,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-08','product_revenue',40000,NULL,NULL),
(NULL,'2023-08','service_revenue',17500,NULL,NULL),
(NULL,'2023-08','material_cost',17200,NULL,NULL),
(NULL,'2023-08','logistics_cost',15500,NULL,NULL),
(NULL,'2023-08','ads',15000,NULL,NULL),
(NULL,'2023-08','promotions',1200,NULL,NULL),
(NULL,'2023-08','salaries',9500,NULL,NULL),
(NULL,'2023-08','rent',3450,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-09','product_revenue',42000,NULL,NULL),
(NULL,'2023-09','service_revenue',20500,NULL,NULL),
(NULL,'2023-09','material_cost',17200,NULL,NULL),
(NULL,'2023-09','logistics_cost',15500,NULL,NULL),
(NULL,'2023-09','ads',25000,NULL,NULL),
(NULL,'2023-09','promotions',2500,NULL,NULL),
(NULL,'2023-09','salaries',10500,NULL,NULL),
(NULL,'2023-09','rent',3500,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-10','product_revenue',43000,NULL,NULL),
(NULL,'2023-10','service_revenue',25500,NULL,NULL),
(NULL,'2023-10','material_cost',15200,NULL,NULL),
(NULL,'2023-10','logistics_cost',16500,NULL,NULL),
(NULL,'2023-10','ads',25000,NULL,NULL),
(NULL,'2023-10','promotions',5500,NULL,NULL),
(NULL,'2023-10','salaries',11500,NULL,NULL),
(NULL,'2023-10','rent',3400,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-11','product_revenue',45000,NULL,NULL),
(NULL,'2023-11','service_revenue',29000,NULL,NULL),
(NULL,'2023-11','material_cost',12800,NULL,NULL),
(NULL,'2023-11','logistics_cost',15500,NULL,NULL),
(NULL,'2023-11','ads',23000,NULL,NULL),
(NULL,'2023-11','promotions',2500,NULL,NULL),
(NULL,'2023-11','salaries',10500,NULL,NULL),
(NULL,'2023-11','rent',4000,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2023-12','product_revenue',45000,NULL,NULL),
(NULL,'2023-12','service_revenue',30000,NULL,NULL),
(NULL,'2023-12','material_cost',13800,NULL,NULL),
(NULL,'2023-12','logistics_cost',15000,NULL,NULL),
(NULL,'2023-12','ads',23000,NULL,NULL),
(NULL,'2023-12','promotions',4500,NULL,NULL),
(NULL,'2023-12','salaries',15500,NULL,NULL),
(NULL,'2023-12','rent',4100,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-01','product_revenue',52000,NULL,NULL),
(NULL,'2024-01','service_revenue',38500,NULL,NULL),
(NULL,'2024-01','material_cost',10700,NULL,NULL),
(NULL,'2024-01','logistics_cost',8900,NULL,NULL),
(NULL,'2024-01','ads',6400,NULL,NULL),
(NULL,'2024-01','promotions',2700,NULL,NULL),
(NULL,'2024-01','salaries',15000,NULL,NULL),
(NULL,'2024-01','rent',4300,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-02','product_revenue',72000,NULL,NULL),
(NULL,'2024-02','service_revenue',52000,NULL,NULL),
(NULL,'2024-02','material_cost',8000,NULL,NULL),
(NULL,'2024-02','logistics_cost',9500,NULL,NULL),
(NULL,'2024-02','ads',7400,NULL,NULL),
(NULL,'2024-02','promotions',2100,NULL,NULL),
(NULL,'2024-02','salaries',14700,NULL,NULL),
(NULL,'2024-02','rent',4300,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-03','product_revenue',82000,NULL,NULL),
(NULL,'2024-03','service_revenue',21000,NULL,NULL),
(NULL,'2024-03','material_cost',20500,NULL,NULL),
(NULL,'2024-03','logistics_cost',12000,NULL,NULL),
(NULL,'2024-03','ads',9000,NULL,NULL),
(NULL,'2024-03','promotions',3500,NULL,NULL),
(NULL,'2024-03','salaries',15200,NULL,NULL),
(NULL,'2024-03','rent',5000,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-04','product_revenue',80000,NULL,NULL),
(NULL,'2024-04','service_revenue',20000,NULL,NULL),
(NULL,'2024-04','material_cost',30000,NULL,NULL),
(NULL,'2024-04','logistics_cost',10000,NULL,NULL),
(NULL,'2024-04','ads',8000,NULL,NULL),
(NULL,'2024-04','promotions',4000,NULL,NULL),
(NULL,'2024-04','salaries',15000,NULL,NULL),
(NULL,'2024-04','rent',5000,NULL,NULL);
""","""
INSERT INTO financials VALUES
(NULL,'2024-05','product_revenue',85000,NULL,NULL),
(NULL,'2024-05','service_revenue',22000,NULL,NULL),
(NULL,'2024-05','material_cost',32000,NULL,NULL),
(NULL,'2024-05','logistics_cost',11000,NULL,NULL),
(NULL,'2024-05','ads',9000,NULL,NULL),
(NULL,'2024-05','promotions',5000,NULL,NULL),
(NULL,'2024-05','salaries',15500,NULL,NULL),
(NULL,'2024-05','rent',5100,NULL,NULL);
"""
, # JUNE (anomaly month)
"""
INSERT INTO financials VALUES
(NULL,'2024-06','product_revenue',83000,NULL,NULL),
(NULL,'2024-06','service_revenue',21000,NULL,NULL),
(NULL,'2024-06','material_cost',34000,NULL,NULL),
(NULL,'2024-06','logistics_cost',12000,NULL,NULL),
(NULL,'2024-06','ads',15000,NULL,NULL),        -- big spike
(NULL,'2024-06','promotions',9000,NULL,NULL),  -- big spike
(NULL,'2024-06','salaries',16000,NULL,NULL),
(NULL,'2024-06','rent',5000,NULL,NULL);
""",
"""
WITH previous AS (
    SELECT 
        curr.period, curr.metric,
        prev_m.nominal AS prev_month_nominal,
        prev_y.nominal AS prev_year_nominal
    FROM financials curr
    LEFT JOIN financials prev_m ON prev_m.metric = curr.metric 
         AND prev_m.period = STRFTIME('%Y-%m', curr.period || '-01', '-1 month')
    LEFT JOIN financials prev_y ON prev_y.metric = curr.metric 
         AND prev_y.period = STRFTIME('%Y-%m', curr.period || '-01', '-12 month')
)
UPDATE financials AS curr
SET mom_change = (curr.nominal - previous.prev_month_nominal) / NULLIF(previous.prev_month_nominal, 0),
    yoy_change = (curr.nominal - previous.prev_year_nominal) / NULLIF(previous.prev_year_nominal, 0)
FROM previous
WHERE curr.metric = previous.metric AND curr.period = previous.period
;
"""]

with engine.connect() as conn:
    for sql_statement in sql_statements:
        conn.execute(text(sql_statement))
    conn.commit()

print("Seeded data.")
