-- Up Migration

GRANT SELECT, INSERT, UPDATE
ON TABLE public.auth_user, public.auth_account
TO client_tracker_app;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.auth_session, public.auth_verification
TO client_tracker_app;

-- Down Migration

REVOKE SELECT, INSERT, UPDATE
ON TABLE public.auth_user, public.auth_account
FROM client_tracker_app;

REVOKE SELECT, INSERT, UPDATE, DELETE
ON TABLE public.auth_session, public.auth_verification
FROM client_tracker_app;