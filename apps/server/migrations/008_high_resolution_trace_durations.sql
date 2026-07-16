ALTER TABLE authorization_traces
  ALTER COLUMN duration_ms TYPE double precision USING duration_ms::double precision;
