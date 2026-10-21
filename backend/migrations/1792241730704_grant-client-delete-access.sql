-- Up Migration
GRANT DELETE
ON TABLE public.clients
TO client_tracker_app;

-- Down Migration
REVOKE DELETE
ON TABLE public.clients
FROM client_tracker_app;