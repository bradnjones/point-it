import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Join from './Join.jsx';

vi.mock('../lib/api.js', () => ({
  createSession: vi.fn(),
  joinSession: vi.fn(),
}));

const { createSession } = await import('../lib/api.js');

function fill(labelRe, value) {
  fireEvent.change(screen.getByLabelText(labelRe), { target: { value } });
}

describe('Join — create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a story backlog session by default', async () => {
    createSession.mockResolvedValue({
      session: { code: 'ABC123' },
      participant: { id: 1, displayName: 'Brad' },
      facilitatorToken: 'tok',
    });
    render(<Join onJoined={vi.fn()} />);

    fill(/session name/i, 'Sprint 42');
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sprint 42', kind: 'stories' })
      )
    );
    // The name field is gone; the client sends no display name.
    expect(createSession.mock.calls[0][0]).not.toHaveProperty('displayName');
  });

  it('sends the Linear 1–10 preset scale', async () => {
    createSession.mockResolvedValue({
      session: { code: 'ABC123' },
      participant: { id: 1, displayName: 'Brad' },
      facilitatorToken: 'tok',
    });
    render(<Join onJoined={vi.fn()} />);

    fill(/session name/i, 'Hourly');
    fireEvent.change(screen.getByLabelText(/point scale/i), { target: { value: 'linear' } });
    fill(/hours per point/i, '2');
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({ scale: '1,2,3,4,5,6,7,8,9,10', hoursPerPoint: '2' })
      )
    );
  });

  it('sends a typed custom scale', async () => {
    createSession.mockResolvedValue({
      session: { code: 'ABC123' },
      participant: { id: 1, displayName: 'Brad' },
      facilitatorToken: 'tok',
    });
    render(<Join onJoined={vi.fn()} />);

    fill(/session name/i, 'Custom');
    fireEvent.change(screen.getByLabelText(/point scale/i), { target: { value: 'custom' } });
    fill(/custom scale/i, '1, 2, 4, 8');
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({ scale: '1, 2, 4, 8', hoursPerPoint: undefined })
      )
    );
  });

  it('creates a quick session when that type is chosen', async () => {
    createSession.mockResolvedValue({
      session: { code: 'ABC123' },
      participant: { id: 1, displayName: 'Brad' },
      facilitatorToken: 'tok',
    });
    const onJoined = vi.fn();
    render(<Join onJoined={onJoined} />);

    fill(/session name/i, 'Ad-hoc');
    fireEvent.click(screen.getByRole('radio', { name: /quick estimate/i }));
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ kind: 'quick' }))
    );
    await waitFor(() =>
      expect(onJoined).toHaveBeenCalledWith(expect.objectContaining({ isFacilitator: true }))
    );
  });
});
