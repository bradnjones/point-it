-- STORY-020: configurable point scales carry an optional time mapping. The
-- `scale` column already exists (0001); this adds the hours each point
-- represents, so a revealed round can show an estimated time. NULL means the
-- scale has no time mapping (the default).
ALTER TABLE sessions
  ADD COLUMN hours_per_point REAL;
