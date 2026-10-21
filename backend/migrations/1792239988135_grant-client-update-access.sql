-- Up Migration
GRANT UPDATE (name)
ON TABLE public.clients
TO client_tracker_app;

-- Down Migration
REVOKE UPDATE (name)
ON TABLE public.clients
FROM client_tracker_app;