import { useState } from 'react';

/**
 * The story backlog panel. Presentational and socket-free: it renders the list
 * and calls the action props, which the Session page wires to socket emits.
 * Non-facilitators see a read-only list with the active story highlighted;
 * facilitators additionally get add/edit/delete/reorder and the "estimate this"
 * control.
 */
export default function StoriesPanel({
  stories,
  activeStoryId,
  isFacilitator,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onSetActive,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const run = (promise) => Promise.resolve(promise).catch((err) => setError(err.message));

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    await run(onAdd(title.trim(), description.trim()));
    setTitle('');
    setDescription('');
  }

  function move(index, delta) {
    const next = stories.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(onReorder(next));
  }

  return (
    <section className="panel">
      <h2>Stories ({stories.length})</h2>

      {isFacilitator && (
        <form className="story-form" onSubmit={handleAdd}>
          <input
            aria-label="Story title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Story title"
          />
          <textarea
            aria-label="Story description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
          />
          <button type="submit" disabled={title.trim().length === 0}>
            Add story
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {stories.length === 0 ? (
        <p className="hint">No stories yet.</p>
      ) : (
        <ol className="stories">
          {stories.map((story, index) =>
            editingId === story.id ? (
              <StoryEditor
                key={story.id}
                story={story}
                onCancel={() => setEditingId(null)}
                onSave={async (fields) => {
                  setError('');
                  await run(onUpdate(story.id, fields));
                  setEditingId(null);
                }}
              />
            ) : (
              <li
                key={story.id}
                className={`story${story.id === activeStoryId ? ' active' : ''}`}
              >
                <div className="story-main">
                  <div className="story-text">
                    <span className="story-title">{story.title}</span>
                    {story.description && (
                      <span className="story-desc">{story.description}</span>
                    )}
                  </div>
                  {story.id === activeStoryId && <span className="badge">estimating</span>}
                </div>

                {isFacilitator && (
                  <div className="story-actions">
                    <button
                      type="button"
                      onClick={() => run(onSetActive(story.id))}
                      disabled={story.id === activeStoryId}
                      title="Estimate this story"
                    >
                      Estimate
                    </button>
                    <button type="button" onClick={() => setEditingId(story.id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${story.title} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === stories.length - 1}
                      aria-label={`Move ${story.title} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => run(onDelete(story.id))}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            )
          )}
        </ol>
      )}
    </section>
  );
}

function StoryEditor({ story, onSave, onCancel }) {
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description ?? '');

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ title: title.trim(), description: description.trim() });
  }

  return (
    <li className="story editing">
      <form className="story-form" onSubmit={handleSubmit}>
        <input
          aria-label="Edit story title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          aria-label="Edit story description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <div className="story-actions">
          <button type="submit" disabled={title.trim().length === 0}>
            Save
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
