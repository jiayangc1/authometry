ALTER TABLE environments ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'disabled'));
