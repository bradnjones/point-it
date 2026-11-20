-- STORY-019: quick (ad-hoc) sessions. `kind` distinguishes a normal backlog
-- session ('stories') from an ad-hoc one ('quick') that estimates repeated
-- rounds against a single implicit story instead of a managed backlog.
-- Orthogonal to `mode` (free_form/pert): a quick session can be either.
ALTER TABLE sessions
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'stories'
    CHECK (kind IN ('stories', 'quick'));
