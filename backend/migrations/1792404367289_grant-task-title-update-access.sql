-- Up Migration
GRANT UPDATE (title)
ON TABLE public.tasks
TO client_tracker_app;

-- Down Migration
REVOKE UPDATE (title)
ON TABLE public.tasks
FROM client_tracker_app;