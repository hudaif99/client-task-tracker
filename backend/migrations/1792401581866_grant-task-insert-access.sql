-- Up Migration
GRANT INSERT (client_id, title)
ON TABLE public.tasks
TO client_tracker_app;

-- Down Migration
REVOKE INSERT (client_id, title)
ON TABLE public.tasks
FROM client_tracker_app;