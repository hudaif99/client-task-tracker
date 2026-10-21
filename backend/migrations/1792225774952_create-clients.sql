-- Up Migration
CREATE TABLE public.clients (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clients_name_valid CHECK (
    char_length(name) <= 120
    AND name ~ '[^[:space:]]'
  )
);

-- Down Migration
DROP TABLE public.clients;