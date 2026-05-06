-- ============================================================
-- Kahramana Baghdad — Dashboard Audit Remediation
-- Migration: 058_dashboard_audit_remediation.sql
-- Description: Enforce RLS on v_vendor_performance via security_invoker.
-- Note: v_inventory_valuation and v_dish_cogs are handled by 044.
-- ============================================================

-- v_vendor_performance (security_invoker for RLS enforcement)
CREATE OR REPLACE VIEW v_vendor_performance
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.name_ar,
  s.name_en,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'received')   AS total_orders,
  COALESCE(
    SUM(poi.quantity_received * poi.unit_cost) FILTER (WHERE po.status = 'received'),
    0
  )                                                              AS total_spent_bhd,
  ROUND(
    AVG(
      CASE
        WHEN poi.quantity_ordered > 0
        THEN GREATEST(0, (1.0 - ABS(poi.quantity_variance) / poi.quantity_ordered)) * 100
        ELSE 100
      END
    ) FILTER (WHERE po.status = 'received'),
    2
  )                                                              AS delivery_accuracy_pct,
  ROUND(
    AVG(poi.quality_rating) FILTER (WHERE po.status = 'received' AND poi.quality_rating IS NOT NULL),
    2
  )                                                              AS avg_quality_rating,
  ROUND(
    AVG(
      CASE
        WHEN po.expected_at IS NOT NULL AND po.received_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (po.received_at - po.expected_at::TIMESTAMPTZ)) / 86400.0
        ELSE 0
      END
    ) FILTER (WHERE po.status = 'received'),
    2
  )                                                              AS avg_delay_days,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'cancelled')  AS cancelled_orders
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.id
LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
GROUP BY s.id, s.name_ar, s.name_en;

COMMENT ON VIEW v_vendor_performance IS 'Enforces RLS via security_invoker for supplier performance metrics.';
