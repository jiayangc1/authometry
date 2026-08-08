ALTER TABLE identity_users
  ADD COLUMN avatar_data bytea,
  ADD COLUMN avatar_content_type text,
  ADD COLUMN avatar_updated_at timestamptz;
