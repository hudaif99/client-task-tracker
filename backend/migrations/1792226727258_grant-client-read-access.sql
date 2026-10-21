-- Up Migration
GRANT USAGE ON SCHEMA public TO client_tracker_app;
GRANT SELECT ON TABLE public.clients TO client_tracker_app;

-- Down Migration
REVOKE SELECT ON TABLE public.clients FROM client_tracker_app;
REVOKE USAGE ON SCHEMA public FROM client_tracker_app;