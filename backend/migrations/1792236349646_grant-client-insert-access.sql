-- Up Migration
GRANT INSERT (name)
ON TABLE public.clients
TO client_tracker_app;

-- Down Migration
REVOKE INSERT (name)
ON TABLE public.clients
FROM client_tracker_app;