-- STORY-005: track which story everyone is currently estimating.
-- ON DELETE SET NULL so deleting the active story simply clears the pointer
-- rather than leaving a dangling reference or blocking the delete.
ALTER TABLE sessions
  ADD COLUMN active_story_id INTEGER
    REFERENCES stories(id) ON DELETE SET NULL;
