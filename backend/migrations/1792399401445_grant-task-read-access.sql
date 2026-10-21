-- Up Migration
GRANT SELECT
ON TABLE public.tasks
TO client_tracker_app;

-- Down Migration
REVOKE SELECT
ON TABLE public.tasks
FROM client_tracker_app;