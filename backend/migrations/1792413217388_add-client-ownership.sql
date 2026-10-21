-- Up Migration

-- One-time assignment of this local lesson's existing clients to the
-- account confirmed by the user. Future owners come from the session.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.auth_user
    WHERE id = 'aZNQpsmlUYxieaX1xnw5GjtwErNT1tiT'
  ) THEN
    RAISE EXCEPTION 'The confirmed owner account does not exist; no ownership changes were applied.';
  END IF;
END;
$$;

ALTER TABLE public.clients
  ADD COLUMN owner_id text
  REFERENCES public.auth_user (id) ON DELETE RESTRICT;

UPDATE public.clients
SET owner_id = 'aZNQpsmlUYxieaX1xnw5GjtwErNT1tiT';

ALTER TABLE public.clients
  ALTER COLUMN owner_id SET NOT NULL;

-- Supports listing one owner's clients in newest-first order.
CREATE INDEX clients_owner_id_id_idx
  ON public.clients (owner_id, id DESC);

-- The app may assign an owner when creating a client, but not reassign it.
GRANT INSERT (owner_id) ON public.clients TO client_tracker_app;

-- Down Migration

-- Rolling back removes ownership information, but preserves clients/tasks.
REVOKE INSERT (owner_id) ON public.clients FROM client_tracker_app;
DROP INDEX public.clients_owner_id_id_idx;
ALTER TABLE public.clients DROP COLUMN owner_id;
