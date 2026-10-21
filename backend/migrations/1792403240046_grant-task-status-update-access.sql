-- Up Migration
GRANT UPDATE (status)
ON TABLE public.tasks
TO client_tracker_app;

-- Down Migration
REVOKE UPDATE (status)
ON TABLE public.tasks
FROM client_tracker_app;