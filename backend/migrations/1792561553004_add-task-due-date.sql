-- Up Migration

-- NULL means no due date. A date stores a calendar day without a time or timezone.
ALTER TABLE public.tasks
  ADD COLUMN due_date date,
  ADD CONSTRAINT tasks_due_date_valid CHECK (
    due_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
  );

GRANT INSERT (due_date), UPDATE (due_date)
ON TABLE public.tasks
TO client_tracker_app;

-- Down Migration

REVOKE INSERT (due_date), UPDATE (due_date)
ON TABLE public.tasks
FROM client_tracker_app;

-- Rolling back preserves tasks but removes any due dates entered later.
ALTER TABLE public.tasks
  DROP CONSTRAINT tasks_due_date_valid,
  DROP COLUMN due_date;
