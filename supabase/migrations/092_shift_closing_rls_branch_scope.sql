-- Tighten shift_closings RLS so branch-scoped roles can only insert rows
-- for their own branch. Previously the WITH CHECK only verified the role,
-- not that staff_basic.branch_id matched the row's branch_id, allowing
-- crafted server actions to insert cross-branch shift closings.
--
-- Owner / general_manager remain unrestricted (branch_id NULL).

DROP POLICY IF EXISTS staff_insert_shift ON shift_closings;
CREATE POLICY staff_insert_shift ON shift_closings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic s
      WHERE s.id = auth.uid()
      AND (
        -- global admins can insert for any branch
        s.role IN ('owner', 'general_manager')
        OR (
          -- branch_manager / cashier limited to their own branch
          s.role IN ('branch_manager', 'cashier')
          AND s.branch_id IS NOT NULL
          AND s.branch_id = shift_closings.branch_id
        )
      )
    )
  );
