-- Up Migration
CREATE TABLE public.tasks (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id integer NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tasks_client_fk
    FOREIGN KEY (client_id)
    REFERENCES public.clients (id)
    ON DELETE CASCADE,

  CONSTRAINT tasks_title_valid CHECK (
    char_length(title) <= 200
    AND title ~ '[^[:space:]]'
  ),

  CONSTRAINT tasks_status_valid CHECK (
    status IN ('pending', 'completed')
  )
);

CREATE INDEX tasks_client_id_idx
ON public.tasks (client_id);

-- Down Migration
DROP TABLE public.tasks;