-- Migration: create budget variance view for Power BI DirectQuery
-- libs/db/prisma/migrations/001_budget_variance_view.sql

CREATE OR REPLACE VIEW view_budget_variance AS
SELECT
    tenant_id,
    TO_CHAR(date, 'YYYY-MM')                                                          AS month_year,
    SUM(CASE WHEN type = 'ACTUAL' THEN amount ELSE 0 END)                             AS actual_revenue,
    SUM(CASE WHEN type = 'BUDGET' THEN amount ELSE 0 END)                             AS budget_target,
    (SUM(CASE WHEN type = 'ACTUAL' THEN amount ELSE 0 END) -
     SUM(CASE WHEN type = 'BUDGET' THEN amount ELSE 0 END))                           AS variance,
    CASE
        WHEN SUM(CASE WHEN type = 'BUDGET' THEN amount ELSE 0 END) = 0 THEN 0
        ELSE (SUM(CASE WHEN type = 'ACTUAL' THEN amount ELSE 0 END) /
              SUM(CASE WHEN type = 'BUDGET' THEN amount ELSE 0 END)) * 100
    END                                                                               AS performance_percentage
FROM finance_metrics
GROUP BY tenant_id, TO_CHAR(date, 'YYYY-MM');
